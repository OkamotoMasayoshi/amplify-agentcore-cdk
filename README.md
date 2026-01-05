# Amplify & AgentCore CDK版ハンズオン

AWSの最新機能をフルに生かした、フルスタックのAIエージェントWebアプリを作ってみましょう。

- フロントエンド： React on Amplify Gen2
- バックエンド： Strands Agents on Bedrock AgentCore（CDK L2コンストラクトでデプロイ）

# 事前準備

### アカウント作成

- AWSアカウントを作成

https://aws.amazon.com/jp/register-flow/

- GitHubアカウントを作成

https://docs.github.com/ja/get-started/start-your-journey/creating-an-account-on-github

### Claudeの利用申請

- AWSアカウントにサインイン（https://console.aws.amazon.com）
    - リージョンを東京に変更
- Claudeモデルの利用申請
    - Amazon Bedrockを検索 > チャット/テキストのプレイグラウンド
    - モデルを選択 > Anthropic > Claude Haiku 4.5 > 適用
    - フォームが出てきたら記入して送信（数分待つ）
    - プレイグラウンドでHaikuとチャットできたらOK

> **Note**: このあとのAWS CLI認証で使うので、AWSマネコンにはサインインしたままにしておいてください。

---

# 1. フロントエンドの構築

### テンプレートから環境作成

- Amplifyのクイックスタートにアクセス

https://docs.amplify.aws/react/start/quickstart/

- テンプレからGitHubリポジトリを作成
    - クイックスタート内「Create repositry from template」をクリック
    - Repository name： `amplify-agentcore-cdk`
    - Choose visibility： Private
- 開発環境を起動
    - Code > Codespaces > Create codespace on main

### AWS認証設定

- AWS CLIをインストール

```sh
# ダウンロード
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"

# 解凍
unzip awscliv2.zip

# インストール
sudo ./aws/install

# ゴミ掃除
rm -rf aws awscliv2.zip
```

- AWS認証を行う

```sh
aws login --remote
```

- リージョンを聞かれたら `ap-northeast-1` と入力
    - URLにアクセスして既存セッションを選択
    - 検証コードをコピーして、ターミナルに貼り付ける

### フロントエンドの開発

> **Note**: フロントエンドはとにかくファイルが大量生成されるのでとっつきにくいですよね。
> 極限まで不要なファイル・コードを削りながら、認知負荷削減を工夫します。

- 不要ファイルの削除

```sh
# ルート階層の不要ファイルを削除
rm -f .eslintrc.cjs CODE_OF_CONDUCT.md CONTRIBUTING.md LICENSE README.md tsconfig.node.json

# 不要なディレクトリを削除
rm -rf public amplify/data src/assets
```

`amplify` ディレクトリ内では、Amplifyで作成したいクラウド機能を定義します。今回はCognitoを用いた認証機能を有効にし、AgentCoreバックエンドをCDKで追加します。

`src` ディレクトリ内には、フロントエンドのメインコードを配置します。

- 以下ファイルをそれぞれ、リンク先の内容で上書き

| ファイル | 説明 |
|----------|------|
| [amplify/auth/resource.ts](./amplify/auth/resource.ts) | 認証設定（メールアドレスでログイン） |
| [src/index.css](./src/index.css) | グローバルスタイル |
| [src/main.tsx](./src/main.tsx) | アプリケーションのエントリーポイント |
| [src/App.tsx](./src/App.tsx) | メインのアプリケーションコンポーネント |
| [src/App.css](./src/App.css) | アプリケーションのスタイル |

> **Note**: フロントエンドのメインコードはApp.tsxです。
> 極力シンプルなコードで、ストリーミングレスポンスの処理まで含めています。コメントを多めに入れているので、さらっと読んでみてください。

- 必要なパッケージを追加

```sh
npm install react-markdown
```

---

# 2. バックエンドの構築（CDK版）

### エージェントコードの作成

- AIエージェント用のディレクトリとコードを作成

```sh
mkdir -p amplify/agent
```

以下のファイルを作成します：

| ファイル | 説明 |
|----------|------|
| [amplify/agent/app.py](./amplify/agent/app.py) | AIエージェントのメインコード |
| [amplify/agent/requirements.txt](./amplify/agent/requirements.txt) | Python依存関係 |
| [amplify/agent/Dockerfile](./amplify/agent/Dockerfile) | コンテナビルド設定 |

> **Note**: Strands Agentsに組み込みのRSSツールを持たせており、AWS What's New RSSから情報取得できるようにしています。

### CDKリソースの作成

CDK L2コンストラクトを使ってAgentCore Runtimeを定義します。

| ファイル | 説明 |
|----------|------|
| [amplify/agent/resource.ts](./amplify/agent/resource.ts) | AgentCore RuntimeのCDK定義 |
| [amplify/backend.ts](./amplify/backend.ts) | Amplifyバックエンド統合 |

**ポイント**:
- `deploy-time-build` ライブラリを使って、AWS CodeBuildでARM64 Dockerイメージを自動ビルド
- ローカルにDockerは不要！Codespacesでも高速にビルドできます
- AgentCore CDK L2コンストラクトでRuntimeを作成
- Cognito認証（JWT）を自動設定

### 必要なパッケージをインストール

```sh
# CDKとAgentCoreのL2コンストラクトを追加
npm install @aws-cdk/aws-bedrock-agentcore-alpha@latest
npm install aws-cdk@latest aws-cdk-lib@latest

# deploy-time-build: CodeBuildでDockerイメージをビルドするライブラリ
npm install deploy-time-build
```

---

# 3. AWSへデプロイ

### CDKブートストラップ

初めてCDKを使うリージョンでは、ブートストラップが必要です。

```sh
# アカウントIDを確認
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# ブートストラップ実行
npx cdk bootstrap aws://$ACCOUNT_ID/ap-northeast-1
```

成功すると以下のリソースが作成されます：
- S3バケット（CDKアセット用）
- ECRリポジトリ（Dockerイメージ用）
- IAMロール（デプロイ用）

### Amplify Sandboxでデプロイ

```sh
# デプロイ実行（Docker不要！）
AWS_REGION=ap-northeast-1 npx ampx sandbox
```

**処理の流れ:**
1. CDKがスタックを合成
2. S3にソースコードをアップロード
3. **CodeBuildがARM64イメージをビルド**（AWS上で実行）
4. ECRにイメージをプッシュ
5. AgentCore Runtimeを作成
6. Cognitoユーザープールを作成

初回デプロイには10〜15分かかります（CodeBuildのビルド時間含む）。

```
✔ Backend synthesized
✔ Type checks completed
✔ Built and published assets
✔ Deployment completed
```

> **Note**: `deploy-time-build` のおかげでDockerビルドはCodeBuild（ARM64ネイティブ環境）で実行されるため、Codespacesのx86環境でもQEMUエミュレーションなしで高速にビルドできます。

---

# 4. 動作確認

### AgentCore Runtimeの確認

デプロイ後に生成される `amplify_outputs.json` を確認：

```sh
cat amplify_outputs.json | jq '.custom'
```

出力例：
```json
{
  "agentRuntimeArn": "arn:aws:bedrock-agentcore:ap-northeast-1:123456789012:runtime/update_checker-xxxxx"
}
```

AWS CLIでも確認できます：

```sh
aws bedrock-agentcore-control list-agent-runtimes --region ap-northeast-1
```

`status: READY` になっていれば成功です！

### フロントエンドの起動

ローカルで動作確認する場合：

```sh
npm run dev
```

ブラウザで表示されたURLにアクセスして、「Create Account」からアカウントを作成します。

- 「先週のAWSアップデートをサマリーして」などと頼んでみましょう！

> **Note**: AIエージェントは、推論しながら何度もツールを使ったりして自律的に行動するため、途中経過をユーザーにリアルタイム表示することが重要です。
> 極力シンプルなコードで、ツール利用状況の表示やテキストのストリーミングに対応させています！

---

# アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Codespaces                         │
│  ┌─────────────┐                                                │
│  │ npx ampx    │                                                │
│  │ sandbox     │ ── CDK Synth ─▶                               │
│  └─────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Cloud                                │
│                                                                  │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐              │
│  │   S3     │ ───▶ │ CodeBuild│ ───▶ │   ECR    │              │
│  │ (source) │      │ (ARM64)  │      │ (image)  │              │
│  └──────────┘      └──────────┘      └──────────┘              │
│                                            │                     │
│                                            ▼                     │
│                                     ┌──────────────┐            │
│                                     │  AgentCore   │            │
│                                     │   Runtime    │            │
│                                     └──────────────┘            │
│                                            │                     │
│                                            ▼                     │
│                                     ┌──────────────┐            │
│                                     │   Cognito    │            │
│                                     │    Auth      │            │
│                                     └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

**ポイント**: DockerビルドはCodeBuild（ARM64ネイティブ環境）で実行されるため、Codespacesのx86環境でもQEMUエミュレーションなしで高速にビルドできます。

---

# クリーンアップ

ハンズオン終了後、リソースを削除する場合：

```sh
# Sandboxを削除
AWS_REGION=ap-northeast-1 npx ampx sandbox delete

# 確認プロンプトで y を入力
```