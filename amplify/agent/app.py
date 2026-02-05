# 必要なライブラリをインポート
from strands import Agent
from strands_tools.rss import rss
from strands.tools.mcp.mcp_client import MCPClient
from mcp.client.streamable_http import streamablehttp_client
from bedrock_agentcore.runtime import BedrockAgentCoreApp

# AgentCoreランタイム用のAPIサーバーを作成
app = BedrockAgentCoreApp()


def convert_event(event) -> dict | None:
    """Strandsのイベントをフロントエンド向けJSON形式に変換"""
    try:
        if not hasattr(event, 'get'):
            return None

        inner_event = event.get('event')
        if not inner_event:
            return None

        # テキスト差分を検知
        content_block_delta = inner_event.get('contentBlockDelta')
        if content_block_delta:
            delta = content_block_delta.get('delta', {})
            text = delta.get('text')
            if text:
                return {'type': 'text', 'data': text}

        # ツール使用開始を検知
        content_block_start = inner_event.get('contentBlockStart')
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
    
    # MCP Gateway接続用のトランスポート作成関数
    def create_mcp_transport():
        return streamablehttp_client(
            "https://graph-calendar-gateway-8ddbslrixp.gateway.bedrock-agentcore.ap-northeast-1.amazonaws.com/mcp",
            headers={"Authorization": f"Bearer {cognito_token}"}
        )
    
    # MCP Clientを作成
    mcp_client = MCPClient(create_mcp_transport)
    
    # AIエージェントを作成（MCP Gatewayツールを含む）
    agent = Agent(
        model="jp.anthropic.claude-haiku-4-5-20251001-v1:0",
        system_prompt="aws.amazon.com/about-aws/whats-new/recent/feed からRSSを取得して",
        tools=[rss, mcp_client]
    )

    # エージェントの応答をストリーミングで取得
    async for event in agent.stream_async(prompt):
        converted = convert_event(event)
        if converted:
            yield converted


# APIサーバーを起動
if __name__ == "__main__":
    app.run()
