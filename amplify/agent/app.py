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
    graph_access_token = payload.get("graphAccessToken")
    user_email = payload.get("userEmail")
    user_principal_name = payload.get("userPrincipalName")
    current_datetime = payload.get("currentDateTime")
    timezone = payload.get("timezone")
    
    # システムプロンプトを構築
    system_prompt = "あなたは業務支援AIアシスタントです。RSSフィードの管理、カレンダーの確認、メールの操作など、ユーザーの業務をサポートします。"
    
    # 現在時刻情報を追加（ローカル時刻に変換）
    if current_datetime and timezone:
        from datetime import datetime
        import pytz
        utc_time = datetime.fromisoformat(current_datetime.replace('Z', '+00:00'))
        local_tz = pytz.timezone(timezone)
        local_time = utc_time.astimezone(local_tz)
        formatted_time = local_time.strftime('%Y年%m月%d日（%a） %H時%M分%S秒')
        system_prompt += f"\n\n現在時刻情報:\n- 日時: {formatted_time}\n- タイムゾーン: {timezone}\n日時に関する質問には、この情報を基準にして回答してください。"
    
    # Graph APIパラメータを追加
    if graph_access_token and user_email:
        system_prompt += f"\n\n重要: カレンダーツールを使用する際は、以下のパラメータを自動的に使用してください:\naccessToken: {graph_access_token}\nuserEmail: {user_email}"
        if user_principal_name:
            system_prompt += f"\nuserPrincipalName: {user_principal_name}"
    
    # ツールリストを作成
    tools = [rss]
    
    # マシントークンでMCP Client初期化
    try:
        machine_token = get_machine_token()
        gateway_url = "https://graph-calendar-gateway-8ddbslrixp.gateway.bedrock-agentcore.ap-northeast-1.amazonaws.com/mcp"
        
        def create_mcp_transport():
            return streamablehttp_client(
                gateway_url,
                headers={"Authorization": f"Bearer {machine_token}"}
            )
        
        mcp_client = MCPClient(create_mcp_transport)
        
        # MCP Clientのコンテキスト内でAgentを実行
        with mcp_client:
            mcp_tools = mcp_client.list_tools_sync()
            tools.extend(mcp_tools)
            
            # AIエージェントを作成
            agent = Agent(
                model="jp.anthropic.claude-haiku-4-5-20251001-v1:0",
                system_prompt=system_prompt,
                tools=tools
            )
            
            # エージェントの応答をストリーミングで取得
            async for event in agent.stream_async(prompt):
                if isinstance(event, dict):
                    # ツール使用イベントのみ通知
                    if event.get('type') == 'tool_use':
                        yield event
                    # テキストイベントは常に出力
                    elif event.get('type') == 'text':
                        yield event
                    # result内のテキストを抽出
                    elif 'result' in event:
                        result = event['result']
                        if hasattr(result, 'message'):
                            message = result.message
                            if isinstance(message, dict) and 'content' in message:
                                for content in message['content']:
                                    if isinstance(content, dict) and 'text' in content:
                                        yield {'type': 'text', 'data': content['text']}
                    
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        yield {'type': 'text', 'data': f'[ERROR] Failed: {str(e)}'}
        yield {'type': 'text', 'data': f'[ERROR] Traceback: {error_detail}'}


# APIサーバーを起動
if __name__ == "__main__":
    app.run()
