🎯 実装計画
Phase 1: Cognito設定変更 (必須)
1.1 Cognitoクライアントにクライアントクレデンシャルフロー追加
// amplify/auth/resource.ts
import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // 追加: リソースサーバーとスコープ定義
  resourceServers: [{
    identifier: 'agentcore-gateway',
    scopes: [{
      scopeName: 'mcp.access',
      scopeDescription: 'Access to MCP Gateway'
    }]
  }]
});

Copy
1.2 専用のマシンクライアント作成
// amplify/backend.ts に追加
import { CfnUserPoolClient } from 'aws-cdk-lib/aws-cognito';

// マシン間通信用クライアント作成
const machineClient = new CfnUserPoolClient(agentCoreStack, 'MachineClient', {
  userPoolId: backend.auth.resources.userPool.userPoolId,
  clientName: 'agentcore-machine-client',
  generateSecret: true,
  allowedOAuthFlows: ['client_credentials'],
  allowedOAuthScopes: ['agentcore-gateway/mcp.access'],
  allowedOAuthFlowsUserPoolClient: true,
});

Copy
typescript
Phase 2: トークン取得機能実装
2.1 クライアントシークレット取得関数
# amplify/agent/app.py に追加
import boto3
import base64
import json
from botocore.exceptions import ClientError

def get_client_secret(client_id: str) -> str:
    """Cognitoクライアントシークレットを取得"""
    client = boto3.client('cognito-idp')
    response = client.describe_user_pool_client(
        UserPoolId='ap-northeast-1_Cir56JeTt',
        ClientId=client_id
    )
    return response['UserPoolClient']['ClientSecret']

Copy
python
2.2 クライアントクレデンシャルフロー実装
import requests

def get_machine_token(client_id: str, client_secret: str, token_url: str) -> str:
    """クライアントクレデンシャルフローでトークン取得"""
    auth_string = f"{client_id}:{client_secret}"
    auth_b64 = base64.b64encode(auth_string.encode()).decode()
    
    response = requests.post(
        token_url,
        headers={
            'Authorization': f'Basic {auth_b64}',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data={
            'grant_type': 'client_credentials',
            'scope': 'agentcore-gateway/mcp.access'
        }
    )
    return response.json()['access_token']

Copy
python
Phase 3: MCP Client統合修正
3.1 環境変数追加
// amplify/agent/resource.ts
runtime.addEnvironment('MACHINE_CLIENT_ID', machineClient.ref);
runtime.addEnvironment('COGNITO_DOMAIN', 'https://your-domain.auth.ap-northeast-1.amazoncognito.com');
runtime.addEnvironment('GATEWAY_URL', 'https://graph-calendar-gateway-8ddbslrixp.gateway.bedrock-agentcore.ap-northeast-1.amazonaws.com/mcp');

Copy
typescript
3.2 MCP Client初期化修正
# amplify/agent/app.py
@app.entrypoint
async def invoke_agent(payload, context):
    prompt = payload.get("prompt")
    tools = [rss]
    
    # マシントークン取得
    try:
        client_id = os.environ['MACHINE_CLIENT_ID']
        client_secret = get_client_secret(client_id)
        token_url = f"{os.environ['COGNITO_DOMAIN']}/oauth2/token"
        gateway_url = os.environ['GATEWAY_URL']
        
        machine_token = get_machine_token(client_id, client_secret, token_url)
        
        def create_mcp_transport():
            return streamablehttp_client(
                gateway_url,
                headers={"Authorization": f"Bearer {machine_token}"}
            )
        
        mcp_client = MCPClient(create_mcp_transport)
        with mcp_client:
            mcp_tools = mcp_client.list_tools_sync()
            tools.extend(mcp_tools)
            yield {'type': 'text', 'data': f'[DEBUG] MCP Client OK. Tools: {len(tools)}'}
    except Exception as e:
        yield {'type': 'text', 'data': f'[ERROR] MCP failed: {str(e)}'}
    
    agent = Agent(
        model="jp.anthropic.claude-haiku-4-5-20251001-v1:0",
        system_prompt="あなたは業務支援AIアシスタントです。",
        tools=tools
    )
    
    async for event in agent.stream_async(prompt):
        if isinstance(event, dict) and 'result' in event:
            result = event['result']
            if hasattr(result, 'message'):
                message = result.message
                if isinstance(message, dict) and 'content' in message:
                    for content in message['content']:
                        if isinstance(content, dict) and 'text' in content:
                            yield {'type': 'text', 'data': content['text']}
        elif isinstance(event, dict):
            yield event


Copy
python
Phase 4: Gateway有効化
4.1 backend.ts修正
// amplify/backend.ts
const { gateway } = createAgentCoreGateway(
  agentCoreStack,
  backend.auth.resources.userPool,
  backend.auth.resources.userPoolClient
);

backend.addOutput({
  custom: {
    agentRuntimeArn: runtime.agentRuntimeArn,
    entraidTokenUrl: `${httpApi.url}token`,
    gatewayUrl: gateway.gatewayMcpEndpoint, // 追加
  },
});

Copy
typescript
📝 実装手順
Step 1: Cognito設定 (手動 or CDK)
# マシンクライアント作成
aws cognito-idp create-user-pool-client \
  --user-pool-id ap-northeast-1_Cir56JeTt \
  --client-name agentcore-machine-client \
  --generate-secret \
  --allowed-o-auth-flows client_credentials \
  --allowed-o-auth-scopes agentcore-gateway/mcp.access \
  --region ap-northeast-1

Copy
bash
Step 2: コード修正
amplify/agent/app.py - トークン取得とMCP Client修正

amplify/agent/resource.ts - 環境変数追加

amplify/backend.ts - Gateway有効化

Step 3: requirements.txt更新
requests
boto3

Copy
txt
Step 4: デプロイ
npx ampx sandbox --once

Copy
bash
⚠️ 注意事項
Cognitoドメイン: User Poolにドメインが必要

IAM権限: Runtimeにcognito-idp:DescribeUserPoolClient権限追加

Gateway Target: Lambda関数との接続確認

キャッシング: トークンは1時間有効なのでキャッシュ推奨

🎯 期待される結果
✅ MCP Client: OK

✅ 利用可能: 2+ ツール (RSS + MCP Gateway経由のツール)

✅ カレンダー操作が可能