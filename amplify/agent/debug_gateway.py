# Gateway接続デバッグスクリプト
import os
import base64
import json
import asyncio
import httpx
import requests

def get_machine_token():
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
    
    if response.status_code != 200:
        raise Exception(f"Token request failed: {response.status_code} - {response.text}")
    
    return response.json()['access_token']

def decode_jwt(token):
    """JWTトークンをデコード"""
    parts = token.split('.')
    if len(parts) >= 2:
        payload = parts[1]
        payload += '=' * (4 - len(payload) % 4)
        return json.loads(base64.b64decode(payload))
    return None

async def test_gateway():
    """Gateway接続テスト"""
    print("=== Gateway Connection Test ===\n")
    
    # 1. 環境変数確認
    print("1. Environment Variables:")
    gateway_url = os.environ.get('GATEWAY_URL', 'NOT_SET')
    print(f"   GATEWAY_URL: {gateway_url}")
    print(f"   COGNITO_DOMAIN: {os.environ.get('COGNITO_DOMAIN', 'NOT_SET')}")
    print(f"   MACHINE_CLIENT_ID: {os.environ.get('MACHINE_CLIENT_ID', 'NOT_SET')[:10]}...")
    print()
    
    # 2. トークン取得
    print("2. Getting Machine Token...")
    try:
        token = get_machine_token()
        print("   ✓ Token obtained")
        claims = decode_jwt(token)
        print(f"   Token claims:")
        print(f"     - client_id: {claims.get('client_id')}")
        print(f"     - scope: {claims.get('scope')}")
        print(f"     - aud: {claims.get('aud')}")
        print(f"     - exp: {claims.get('exp')}")
    except Exception as e:
        print(f"   ✗ Failed: {e}")
        return
    print()
    
    # 3. Gateway疎通確認
    print("3. Testing Gateway Connection...")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                gateway_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "tools/list"
                }
            )
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            
            if response.status_code == 200:
                print("   ✓ Gateway connection successful")
                data = response.json()
                if 'result' in data and 'tools' in data['result']:
                    tools = data['result']['tools']
                    print(f"   ✓ Found {len(tools)} tools:")
                    for tool in tools[:5]:
                        print(f"     - {tool.get('name')}")
            else:
                print(f"   ✗ Gateway returned error: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Connection failed: {e}")
    print()
    
    # 4. MCP Client テスト
    print("4. Testing MCP Client...")
    try:
        from mcp.client.streamable_http import streamablehttp_client
        from mcp import ClientSession
        
        async with streamablehttp_client(
            gateway_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        ) as (read_stream, write_stream, _):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                tools = await session.list_tools()
                print(f"   ✓ MCP Client initialized")
                print(f"   ✓ Tools: {len(tools.tools)}")
                for tool in tools.tools[:5]:
                    print(f"     - {tool.name}")
    except Exception as e:
        print(f"   ✗ MCP Client failed: {e}")
        import traceback
        print(f"   Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    asyncio.run(test_gateway())
