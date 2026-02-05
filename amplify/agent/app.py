# 必要なライブラリをインポート
import logging
from strands import Agent
from strands_tools.rss import rss
from strands.tools.mcp.mcp_client import MCPClient
from mcp.client.streamable_http import streamablehttp_client
from bedrock_agentcore.runtime import BedrockAgentCoreApp

# ロガー設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AgentCoreランタイム用のAPIサーバーを作成
app = BedrockAgentCoreApp()


def convert_event(event) -> dict | None:
    """Strandsのイベントをフロントエンド向けJSON形式に変換"""
    try:
        if not isinstance(event, dict):
            return None

        # テキスト差分を検知
        content_block_delta = event.get('contentBlockDelta')
        if content_block_delta:
            delta = content_block_delta.get('delta', {})
            text = delta.get('text')
            if text:
                return {'type': 'text', 'data': text}

        # ツール使用開始を検知
        content_block_start = event.get('contentBlockStart')
        if content_block_start:
            start = content_block_start.get('start', {})
            tool_use = start.get('toolUse')
            if tool_use:
                tool_name = tool_use.get('name', 'unknown')
                return {'type': 'tool_use', 'tool_name': tool_name}

        return None
    except Exception:
        return None


# エージェント呼び出し関数を、APIサーバーのエントリーポイントに設定
@app.entrypoint
async def invoke_agent(payload, context):

    # フロントエンドで入力されたプロンプトを取得
    prompt = payload.get("prompt")
    cognito_token = payload.get("cognitoToken", "")
    
    # ツールリストを作成
    tools = [rss]
    
    # Cognitoトークンがある場合のみMCP Clientを追加
    if cognito_token:
        try:
            def create_mcp_transport():
                return streamablehttp_client(
                    "https://graph-calendar-gateway-8ddbslrixp.gateway.bedrock-agentcore.ap-northeast-1.amazonaws.com/mcp",
                    headers={"Authorization": f"Bearer {cognito_token}"}
                )
            mcp_client = MCPClient(create_mcp_transport)
            await mcp_client.initialize()
            tools.append(mcp_client)
            # 初期化成功をフロントエンドに通知
            yield {'type': 'text', 'data': f'[DEBUG] MCP Client initialized. Tools: {len(tools)}'}
        except Exception as e:
            # エラーをフロントエンドに通知
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
