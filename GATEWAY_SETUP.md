# AgentCore Gateway統合 実装完了

## 実装内容

### 1. 作成ファイル
- `amplify/gateway/resource.ts` - Gateway CDK定義
- `amplify/gateway/tool-schema.json` - 3つのツールスキーマ定義
- `amplify/backend.ts` - Gateway統合追加

### 2. 統合されたツール
1. **getCalendar** - カレンダー予定取得
2. **getBusySlots** - 空き時間検索
3. **createEvent** - 予定登録

### 3. アーキテクチャ
```
AIエージェント
    ↓ (OAuth 2.0 JWT)
AgentCore Gateway
    ↓ (IAM Role)
Lambda: GraphAPICalendar
    ↓ (Access Token)
Microsoft Graph API
```

## デプロイ手順

```bash
# Amplify Sandboxでデプロイ
npx ampx sandbox

# または本番環境へプッシュ
git add .
git commit -m "Add AgentCore Gateway integration"
git push
```

## Gateway使用方法

### エージェントからの呼び出し例

```python
from strands_agents import Agent

agent = Agent(
    mcp_servers=[{
        "url": "<GATEWAY_MCP_ENDPOINT>",
        "auth": {
            "type": "oauth",
            "token": "<COGNITO_JWT_TOKEN>"
        }
    }]
)

# ツール呼び出し
result = agent.call_tool(
    "CalendarTools__getCalendar",
    {
        "accessToken": "<GRAPH_API_TOKEN>",
        "userEmail": "user@example.com",
        "startDate": "2024-12-01T00:00:00Z",
        "endDate": "2024-12-31T23:59:59Z"
    }
)
```

### 注意事項

1. **ツール名プレフィックス**: Gateway経由では`CalendarTools__<toolName>`形式
2. **Lambda側の対応**: Lambda関数でプレフィックス除去が必要
3. **IAM権限**: Gateway → Lambda呼び出し権限は自動設定
4. **認証**: Cognito JWTトークンが必要

## 確認コマンド

```bash
# Gatewayが作成されたか確認
aws bedrock-agentcore list-gateways --region ap-northeast-1

# Gateway詳細確認
aws bedrock-agentcore get-gateway --gateway-id <GATEWAY_ID> --region ap-northeast-1

# Targetが登録されたか確認
aws bedrock-agentcore list-gateway-targets --gateway-id <GATEWAY_ID> --region ap-northeast-1
```

## トラブルシューティング

### Lambda関数が見つからない
→ Lambda関数名が`GraphAPICalendar`であることを確認

### ツールスキーマエラー
→ `tool-schema.json`の形式を確認

### 認証エラー
→ Cognito UserPoolとClientが正しく設定されているか確認
