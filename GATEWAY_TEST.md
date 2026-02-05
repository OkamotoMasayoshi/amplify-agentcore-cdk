# AgentCore Gateway 動作確認

## Gateway情報

- **Gateway ID**: `graph-calendar-gateway-8ddbslrixp`
- **Gateway ARN**: `arn:aws:bedrock-agentcore:ap-northeast-1:978594444268:gateway/graph-calendar-gateway-8ddbslrixp`
- **User Pool ID**: `ap-northeast-1_Cir56JeTt`
- **Client ID**: `753jhbiqijvbi8oum4t1021fpl`

## 1. MCPエンドポイント確認

AWSコンソール → Bedrock → AgentCore → Gateways → graph-calendar-gateway
→ **MCP endpoint URL** をコピー

## 2. アクセストークン取得

```bash
# Token endpoint
TOKEN_ENDPOINT="https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_Cir56JeTt"

# Client credentials (Cognitoコンソールで確認)
CLIENT_ID="753jhbiqijvbi8oum4t1021fpl"
CLIENT_SECRET="<取得が必要>"

# トークン取得
curl -X POST "${TOKEN_ENDPOINT}/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "scope=openid email profile"
```

## 3. Gateway経由でツール呼び出し

```python
import requests

# Gateway MCP endpoint
MCP_ENDPOINT = "<GatewayのMCPエンドポイント>"
ACCESS_TOKEN = "<取得したアクセストークン>"

# ツール一覧取得
response = requests.post(
    MCP_ENDPOINT,
    headers={
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    },
    json={
        "jsonrpc": "2.0",
        "method": "tools/list",
        "id": 1
    }
)
print(response.json())

# カレンダー取得テスト
response = requests.post(
    MCP_ENDPOINT,
    headers={
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    },
    json={
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "calendar-tools__getCalendar",
            "arguments": {
                "accessToken": "<Graph API Token>",
                "userEmail": "user@example.com",
                "startDate": "2024-12-01T00:00:00Z",
                "endDate": "2024-12-31T23:59:59Z"
            }
        },
        "id": 2
    }
)
print(response.json())
```

## 4. AgentCore Runtimeから利用

```python
from strands_agents import Agent

agent = Agent(
    mcp_servers=[{
        "url": "<MCP_ENDPOINT>",
        "auth": {
            "type": "oauth",
            "token": ACCESS_TOKEN
        }
    }]
)

# エージェントがツールを自動利用
result = agent.run("明日の予定を教えて")
```

## トラブルシューティング

### 401 Unauthorized
- アクセストークンの有効期限を確認
- Allowed clients/audiences設定を確認

### 403 Forbidden
- Lambda権限を確認
- Gateway Service Roleを確認

### ツールが見つからない
- Target名プレフィックス: `calendar-tools__<toolName>`
- 例: `calendar-tools__getCalendar`
