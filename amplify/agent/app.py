# 必要なライブラリをインポート
import os
import base64
import requests
from strands import Agent
from strands_tools.rss import rss
from strands.tools.mcp.mcp_client import MCPClient
from mcp.client.streamable_http import streamablehttp_client
from bedrock_agentcore.runtime import BedrockAgentCoreApp

# AgentCoreランタイム用のAPIサーバーを作成
app = BedrockAgentCoreApp()


def get_machine_token() -> str:
    """クライアントクレデンシャルフローでトークン取得"""
    client_id = os.environ['MACHINE_CLIENT_ID']
    client_secret = os.environ['MACHINE_CLIENT_SECRET']
    token_url = "https://amplify-agentcore.auth.ap-northeast-1.amazoncognito.com/oauth2/token"
    scope = "agentcore-gateway/mcp.access"
    
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
            'scope': scope
        }
    )
    
    # レスポンスのデバッグ情報を追加
    if response.status_code != 200:
        raise Exception(f"Token request failed: {response.status_code} - {response.text}")
    
    response_data = response.json()
    if 'access_token' not in response_data:
        raise Exception(f"No access_token in response: {response_data}")
    
    return response_data['access_token']


# エージェント呼び出し関数を、APIサーバーのエントリーポイントに設定
@app.entrypoint
async def invoke_agent(payload, context):

    # フロントエンドで入力されたプロンプトを取得
    prompt = payload.get("prompt")
    
    # ツールリストを作成
    tools = [rss]
    
    # マシントークンでMCP Client初期化
    try:
        yield {'type': 'text', 'data': '[DEBUG] Getting machine token...'}
        machine_token = get_machine_token()
        gateway_url = "https://graph-calendar-gateway-8ddbslrixp.gateway.bedrock-agentcore.ap-northeast-1.amazonaws.com/mcp"
        
        # トークンの内容をデコードして確認
        import json
        token_parts = machine_token.split('.')
        if len(token_parts) >= 2:
            # JWTのペイロード部分をデコード（パディング調整）
            payload = token_parts[1]
            payload += '=' * (4 - len(payload) % 4)
            decoded = json.loads(base64.b64decode(payload))
            yield {'type': 'text', 'data': f'[DEBUG] Token claims: client_id={decoded.get("client_id")}, scope={decoded.get("scope")}'}
        
        yield {'type': 'text', 'data': f'[DEBUG] Token obtained. Gateway: {gateway_url}'}
        yield {'type': 'text', 'data': '[DEBUG] Initializing MCP Client...'}
        
        def create_mcp_transport():
            return streamablehttp_client(
                gateway_url,
                headers={"Authorization": f"Bearer {machine_token}"}
            )
        
        mcp_client = MCPClient(create_mcp_transport)
        yield {'type': 'text', 'data': '[DEBUG] MCP Client created, entering context...'}
        
        with mcp_client:
            yield {'type': 'text', 'data': '[DEBUG] Listing tools...'}
            mcp_tools = mcp_client.list_tools_sync()
            tools.extend(mcp_tools)
            yield {'type': 'text', 'data': f'[DEBUG] MCP Client initialized. Tools: {len(tools)}'}
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        yield {'type': 'text', 'data': f'[ERROR] MCP Client failed: {str(e)}'}
        yield {'type': 'text', 'data': f'[ERROR] Traceback: {error_detail}'}
    
    # AIエージェントを作成
    agent = Agent(
        model="jp.anthropic.claude-haiku-4-5-20251001-v1:0",
        system_prompt="あなたは業務支援AIアシスタントです。RSSフィードの管理、カレンダーの確認、メールの操作など、ユーザーの業務をサポートします。",
        tools=tools
    )

    # エージェントの応答をストリーミングで取得
    async for event in agent.stream_async(prompt):
        # AgentResultオブジェクトの場合
        if isinstance(event, dict) and 'result' in event:
            result = event['result']
            if hasattr(result, 'message'):
                message = result.message
                if isinstance(message, dict) and 'content' in message:
                    for content in message['content']:
                        if isinstance(content, dict) and 'text' in content:
                            yield {'type': 'text', 'data': content['text']}
        # 通常のイベントの場合
        elif isinstance(event, dict):
            yield event


# APIサーバーを起動
if __name__ == "__main__":
    app.run()
