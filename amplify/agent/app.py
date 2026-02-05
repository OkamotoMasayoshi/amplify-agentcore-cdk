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
    token_url = f"{os.environ['COGNITO_DOMAIN']}/oauth2/token"
    scope = os.environ.get('COGNITO_SCOPE', 'default-m2m-resource-server-tx0jxc/read')
    
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
        gateway_url = os.environ['GATEWAY_URL']
        
        yield {'type': 'text', 'data': '[DEBUG] Initializing MCP Client...'}
        def create_mcp_transport():
            return streamablehttp_client(
                gateway_url,
                headers={"Authorization": f"Bearer {machine_token}"}
            )
        
        mcp_client = MCPClient(create_mcp_transport)
        with mcp_client:
            mcp_tools = mcp_client.list_tools_sync()
            tools.extend(mcp_tools)
            yield {'type': 'text', 'data': f'[DEBUG] MCP Client initialized. Tools: {len(tools)}'}
    except Exception as e:
        yield {'type': 'text', 'data': f'[ERROR] MCP Client failed: {str(e)}'}
    
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
