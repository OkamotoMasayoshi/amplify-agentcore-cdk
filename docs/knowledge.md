# AgentCore + Amplify 連携の学び

## CognitoトークンでAgentCoreを呼び出す際の設定

### IDトークン vs アクセストークン

| トークン | 用途 | 主要クレーム | AgentCore設定 |
|---------|------|-------------|---------------|
| IDトークン | ユーザー情報の取得 | `aud`（クライアントID） | `allowedAudience` |
| アクセストークン | API呼び出し | `client_id` | `allowedClients` |

### 正しい組み合わせ

**OAuth 2.0標準に沿った設計:**
- フロントエンド: `session.tokens?.accessToken` を使用
- AgentCore: `allowedClients` でclient_idを検証

```typescript
// App.tsx
const accessToken = session.tokens?.accessToken?.toString();
const res = await fetch(url, {
  headers: { 'Authorization': `Bearer ${accessToken}` },
});
```

### よくある間違い

| 設定 | 問題 |
|------|------|
| IDトークン + allowedClients | IDトークンにclient_idクレームがないため401 |
| 両方設定（allowedAudience + allowedClients） | 両方検証されるため、片方のクレームがないと401 |

### 複数環境での注意

- `discoveryUrl`は1つしか設定できない
- サンドボックスと本番で異なるCognitoを使う場合、AgentCore設定の切り替えが必要

### 参考

- [Configure inbound JWT authorizer](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/inbound-jwt-authorizer.html)

---

## strands_toolsのインポート問題 [解決済み]

### 問題
AgentCore環境で `from strands_tools import rss` を実行すると以下のエラー発生：

```
ImportError: cannot import name 'rss' from 'strands_tools' (/var/task/strands_tools/__init__.py)
```

### 原因
`strands_tools`パッケージの`__init__.py`が空のため、`from X import Y` 形式ではインポートできない。

### Pythonインポートの仕組み

| 書き方 | 動作 | 結果 |
|--------|------|------|
| `from strands_tools import rss` | `__init__.py`からエクスポートを探す | ❌ 空なのでNG |
| `from strands_tools.rss import rss` | `rss.py`から関数を直接インポート | ✅ OK |
| `import strands_tools.rss` | モジュールとしてインポート | ✅ OK |

### 解決策

**方法1**: モジュールから直接インポート（推奨）
```python
from strands_tools.rss import rss
```

**方法2**: feedparserで自作ツールを作成
```python
import feedparser
from strands import tool

@tool
def rss_fetch(url: str) -> list:
    feed = feedparser.parse(url)
    return [{"title": e.title, "link": e.link} for e in feed.entries[:10]]
```

### 補足: Strands SDKのモジュールベースツール

Strands SDKはモジュールオブジェクトもツールとして受け入れる（`TOOL_SPEC`や`@tool`デコレータを自動検出）。
ただし、`from X import Y` 形式ではモジュールではなく名前付きエクスポートを探すため、`__init__.py`が空だとエラーになる。

### 参考
- [strands_tools rss.py](https://github.com/strands-agents/tools/blob/main/src/strands_tools/rss.py)
- [Strands Creating Custom Tools](https://strandsagents.com/latest/documentation/docs/user-guide/concepts/tools/custom-tools/)

---

## feedparser ビルド問題（Python 3.13）

### 問題
`agentcore deploy` でローカルビルド時に以下のエラー：

```
feedparser>=6.0.2 depends on sgmllib3k
sgmllib3k==1.0.0 has no usable wheels
```

### 原因
- AgentCore CLIはローカルの Python（3.13）で依存関係をビルド
- `feedparser` が依存する `sgmllib3k` に Python 3.13 用の wheel がない
- `--no-build` オプションでソースビルドが無効化されている

### 解決策

**コンテナデプロイを使用**（推奨）
```bash
agentcore configure  # deployment_type: container を選択
agentcore deploy
```

コンテナデプロイでは AWS CodeBuild が正しい環境でビルドするため、ローカルの Python バージョンに依存しない。

### 補足
- `agentcore configure` で `python3.12` を選択しても、ローカルビルドは Python 3.13 を使う
- `--local-build` オプションでも Docker を使ったビルドが可能

---

## AgentCore ストリーミングレスポンスの処理

### 問題
フロントエンドで `res.json()` を使うと以下のエラー：

```
SyntaxError: Unexpected token 'd', "data: {"in"... is not valid JSON
```

### 原因
AgentCore は SSE（Server-Sent Events）形式でストリーミングレスポンスを返す。

### 解決策：フロントエンドでSSEを処理

```typescript
const reader = res.body?.getReader();
const decoder = new TextDecoder();
let fullText = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value, { stream: true });
  const lines = chunk.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;

      try {
        const event = JSON.parse(data);
        const text = event.data || event.delta?.text;
        if (text && typeof text === 'string') {
          fullText += text;
          setResponse(fullText);
        }
      } catch {
        // JSONパースエラーは無視
      }
    }
  }
}
```

---

## Strands ストリーミングイベントのシリアライズ

### 問題
バックエンドで `yield event` するとフロントに Python の repr 形式で届く：

```
{'data': 'こ', 'delta': {'text': 'こ'}, 'agent': <strands.agent.Agent object at 0x...>}
```

### 原因
Strands の `stream_async()` が返すイベントは Python オブジェクトで、そのまま yield すると repr 形式で文字列化される。

### 解決策：バックエンドでイベントをJSON形式に変換

```python
stream = agent.stream_async(prompt)
async for event in stream:
    # イベントからテキストを抽出してJSON形式で返す
    if isinstance(event, dict):
        text = event.get("data") or event.get("delta", {}).get("text")
        if text:
            yield {"type": "text", "data": text}
```

### SSEイベント形式

| フィールド | 説明 |
|-----------|------|
| `event.data` | テキストチャンク |
| `event.delta.text` | テキストチャンク（別形式） |
| `event.type` | イベント種別（`text`, `tool_use` など） |

---
*最終更新: 2026-01-01*
