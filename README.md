# Amplify & AgentCore CDKテンプレ

AWSの最新機能をフルに生かした、フルスタックのAIエージェントWebアプリを簡単にデプロイできます。

### 特徴

- フルサーバーレスなので維持費激安。ほぼLLMのAPI料金のみで運用できます。
- エンプラReadyなセキュリティ。Cognito認証付き、東京リージョン対応。WAFでIP制限もできます。

![画面イメージ](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/1633856/109a3b02-b137-49e9-9b37-2dfc49481a4e.png)


### アーキテクチャ

- フロントエンド： React + Vite
- バックエンド： Bedrock AgentCoreランタイム
- インフラ： Amplify Gen2 + AWS CDK

![アーキテクチャ](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/1633856/8792ff3f-0db0-4f23-9d87-7d4d995d6bb5.png)


### デプロイ手順

1. このリポジトリを自分のGitHubアカウントにフォーク
2. `.env`ファイルを作成してEntra ID設定を追加（`.env.example`を参考）
3. Amplify Gen2にリポジトリのURLを登録
4. Amplifyコンソールで環境変数を設定
   - `VITE_ENTRAID_CLIENT_ID`
   - `VITE_ENTRAID_TENANT_ID`
   - `VITE_REDIRECT_URI`

→ これだけで自動的にフロントエンド＆バックエンドがデプロイされます。


### 便利なTips

- `npx ampx sandbox` でローカル開発用の占有インフラを一時デプロイできます。
- `dev` など新しいブランチをAmplifyにプッシュすると、検証環境などを簡単に増やせます。