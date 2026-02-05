// AgentCore APIテスト
// 使い方: ブラウザのDevToolsからCognitoトークンをコピーして ACCESS_TOKEN に設定

const ACCESS_TOKEN = 'YOUR_COGNITO_TOKEN_HERE';
const RUNTIME_ARN = 'arn:aws:bedrock-agentcore:ap-northeast-1:978594444268:runtime/update_checker_oken157-HZzlZbGjct';

async function testAgentCore() {
  if (ACCESS_TOKEN === 'YOUR_COGNITO_TOKEN_HERE') {
    console.log('使い方:');
    console.log('1. ブラウザでアプリにログイン');
    console.log('2. DevTools > Application > Local Storage > accessToken をコピー');
    console.log('3. このファイルの ACCESS_TOKEN に貼り付け');
    console.log('4. node test-agent.mjs を実行');
    return;
  }

  const url = `https://bedrock-agentcore.ap-northeast-1.amazonaws.com/runtimes/${encodeURIComponent(RUNTIME_ARN)}/invocations?qualifier=DEFAULT`;
  console.log('Calling AgentCore API...');
  console.log('URL:', url);
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      prompt: 'こんにちは',
      cognitoToken: ACCESS_TOKEN
    }),
  });

  console.log('Status:', res.status);
  console.log('Headers:', Object.fromEntries(res.headers.entries()));

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Error:', errorText);
    return;
  }

  // ストリーミングレスポンスを読む
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventCount = 0;

  console.log('\n--- Streaming Response ---');
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          console.log('[DONE]');
          continue;
        }
        try {
          const event = JSON.parse(data);
          eventCount++;
          console.log(`Event ${eventCount}:`, JSON.stringify(event, null, 2));
        } catch (e) {
          console.log('Raw:', data);
        }
      }
    }
  }

  console.log(`\n✓ Received ${eventCount} events`);
}

testAgentCore().catch(console.error);
