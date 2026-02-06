// 必要なパッケージをインポート
import { useState, useRef, useEffect, type FormEvent } from 'react';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import ReactMarkdown from 'react-markdown';
import './App.css';
import outputs from '../amplify_outputs.json';

// Amplify outputs から設定を取得
const AGENT_ARN = outputs.custom?.agentRuntimeArn;

// Entra IDユーザー情報の型
interface EntraidUser {
  name: string;
  email: string;
  department?: string;
  jobTitle?: string;
  accessToken?: string; // Graph API用トークン
}

// チャットメッセージの型定義
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isToolUsing?: boolean;
  toolCompleted?: boolean;
  toolName?: string;
}

// ステータス情報の型定義
interface StatusInfo {
  cognitoAuth: boolean;
  entraidAuth: boolean;
  toolsCount: number;
  mcpStatus: 'unknown' | 'initializing' | 'ready' | 'failed';
  mcpError?: string;
}

// メインのアプリケーションコンポーネント
function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [entraidUser, setEntraidUser] = useState<EntraidUser | null>(null);
  const [status, setStatus] = useState<StatusInfo>({
    cognitoAuth: false,
    entraidAuth: false,
    toolsCount: 1,
    mcpStatus: 'unknown'
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Entra IDユーザー情報を読み込み
  useEffect(() => {
    const userStr = localStorage.getItem('entraidUser');
    if (userStr) {
      setEntraidUser(JSON.parse(userStr));
      setStatus(prev => ({ ...prev, entraidAuth: true }));
    }
  }, []);

  // Cognito認証状態を確認
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await fetchAuthSession();
        setStatus(prev => ({ ...prev, cognitoAuth: !!session.tokens?.accessToken }));
      } catch {
        setStatus(prev => ({ ...prev, cognitoAuth: false }));
      }
    };
    checkAuth();
  }, []);

  // ログアウト処理
  const handleLogout = () => {
    localStorage.removeItem('entraidUser');
    setEntraidUser(null);
    signOut();
  };

  // メッセージ追加時に自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // フォーム送信処理
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    // ユーザーメッセージを作成
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: input.trim() };

    // メッセージ配列に追加（ユーザー発言 + 空のAI応答）
    setMessages(prev => [...prev, userMessage, { id: crypto.randomUUID(), role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    // Cognito認証トークンを取得
    const session = await fetchAuthSession();
    const accessToken = session.tokens?.accessToken?.toString();

    // AgentCore Runtime APIを呼び出し
    const url = `https://bedrock-agentcore.ap-northeast-1.amazonaws.com/runtimes/${encodeURIComponent(AGENT_ARN)}/invocations?qualifier=DEFAULT`;
    console.log('Calling AgentCore:', url);
    console.log('Payload:', { prompt: userMessage.content });
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: userMessage.content,
        cognitoToken: accessToken,
        graphAccessToken: entraidUser?.accessToken,
        userEmail: entraidUser?.email
      }),
    });
    
    console.log('Response status:', res.status);
    console.log('Response headers:', Object.fromEntries(res.headers.entries()));
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('API Error:', errorText);
      setLoading(false);
      return;
    }

    // SSEストリーミングを処理
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let isInToolUse = false;
    let toolIdx = -1;

    // ストリームを読み続ける
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 受信データを行ごとに処理
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        let event;
        try {
          event = JSON.parse(data);
          // console.log('Received event:', event); // デバッグログをコメントアウト
          
          // デバッグメッセージを検知してステータス更新
          if (event.type === 'text' && event.data) {
            if (event.data.includes('[DEBUG] Initializing MCP Client')) {
              setStatus(prev => ({ ...prev, mcpStatus: 'initializing' }));
            } else if (event.data.includes('[DEBUG] MCP Client initialized')) {
              const match = event.data.match(/Tools: (\d+)/);
              if (match) {
                setStatus(prev => ({ ...prev, mcpStatus: 'ready', toolsCount: parseInt(match[1]) }));
              }
            } else if (event.data.includes('[ERROR] MCP Client failed')) {
              const errorMatch = event.data.match(/\[ERROR\] MCP Client failed: (.+)/);
              setStatus(prev => ({ 
                ...prev, 
                mcpStatus: 'failed', 
                mcpError: errorMatch ? errorMatch[1] : 'Unknown error'
              }));
            } else if (event.data.includes('[DEBUG] No Cognito token')) {
              setStatus(prev => ({ ...prev, mcpStatus: 'unknown', toolsCount: 1 }));
            }
          }
        } catch (e) {
          console.error('Failed to parse event:', data);
          continue;
        }

        // ツール使用開始イベント
        if (event.type === 'tool_use') {
          isInToolUse = true;
          const savedBuffer = buffer;
          setMessages(prev => {
            const msgs = [...prev];
            if (savedBuffer) {
              msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: savedBuffer };
              toolIdx = msgs.length;
              msgs.push({ id: crypto.randomUUID(), role: 'assistant', content: '', isToolUsing: true, toolName: event.tool_name });
            } else {
              toolIdx = msgs.length - 1;
              msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], isToolUsing: true, toolName: event.tool_name };
            }
            return msgs;
          });
          buffer = '';
          continue;
        }

        // テキストイベント（AI応答本文）
        if (event.type === 'text' && event.data) {
          if (isInToolUse && !buffer) {
            // ツール実行後の最初のテキスト → ツールを完了状態に
            const savedIdx = toolIdx;
            setMessages(prev => {
              const msgs = [...prev];
              if (savedIdx >= 0 && savedIdx < msgs.length) msgs[savedIdx] = { ...msgs[savedIdx], toolCompleted: true };
              msgs.push({ id: crypto.randomUUID(), role: 'assistant', content: event.data });
              return msgs;
            });
            buffer = event.data;
            isInToolUse = false;
            toolIdx = -1;
          } else {
            // 通常のテキスト蓄積（ストリーミング表示）
            buffer += event.data;
            setMessages(prev => {
              const msgs = [...prev];
              msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: buffer, isToolUsing: false };
              return msgs;
            });
          }
        }
      }
    }
    setLoading(false);
  };

  // チャットUI（サイドバー＋メインエリア）
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 左サイドバー */}
      <div style={{ width: '280px', borderRight: '1px solid #e0e0e0', padding: '20px', overflowY: 'auto', flexShrink: 0 }}>
        <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>ステータス</h2>
        
        {/* ユーザー情報 */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>ユーザー</h3>
          {entraidUser ? (
            <div style={{ fontSize: '12px', color: '#666' }}>
              <div>{entraidUser.name}</div>
              <div>{entraidUser.email}</div>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#999' }}>未ログイン</div>
          )}
        </div>

        {/* 認証状態 */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>認証</h3>
          <div style={{ fontSize: '12px' }}>
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: status.cognitoAuth ? '#4caf50' : '#f44336' }}>●</span>
              {' '}Cognito: {status.cognitoAuth ? 'OK' : 'NG'}
            </div>
            <div>
              <span style={{ color: status.entraidAuth ? '#4caf50' : '#f44336' }}>●</span>
              {' '}Entra ID: {status.entraidAuth ? 'OK' : 'NG'}
            </div>
          </div>
        </div>

        {/* ツール状態 */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>ツール</h3>
          <div style={{ fontSize: '12px' }}>
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: '#4caf50' }}>●</span> RSS Feed (常時)
            </div>
            <div>
              <span style={{ 
                color: status.mcpStatus === 'ready' ? '#4caf50' : 
                       status.mcpStatus === 'failed' ? '#f44336' : '#999' 
              }}>●</span>
              {' '}MCP Client: {
                status.mcpStatus === 'ready' ? 'OK' :
                status.mcpStatus === 'failed' ? 'エラー' :
                status.mcpStatus === 'initializing' ? '初期化中' : '未確認'
              }
            </div>
            {status.mcpError && (
              <div style={{ fontSize: '11px', color: '#f44336', marginTop: '4px', wordBreak: 'break-word' }}>
                {status.mcpError}
              </div>
            )}
          </div>
        </div>

        {/* 必須パラメータ */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Graph API</h3>
          <div style={{ fontSize: '12px' }}>
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: entraidUser?.accessToken ? '#4caf50' : '#f44336' }}>●</span>
              {' '}トークン: {entraidUser?.accessToken ? 'OK' : 'NG'}
            </div>
            <div>
              <span style={{ color: entraidUser?.email ? '#4caf50' : '#f44336' }}>●</span>
              {' '}メール: {entraidUser?.email ? 'OK' : 'NG'}
            </div>
          </div>
        </div>

        {/* 合計ツール数 */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>利用可能</h3>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>
            {status.toolsCount} ツール
          </div>
        </div>

        {entraidUser && (
          <button 
            onClick={handleLogout} 
            style={{ 
              width: '100%', 
              padding: '8px', 
              fontSize: '12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            ログアウト
          </button>
        )}
      </div>

      {/* メインチャットエリア */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header className="header">
          <h1 className="title">フルサーバーレスなAIエージェントアプリ</h1>
          <p className="subtitle">AmplifyとAgentCoreで構築しています</p>
        </header>

        <div className="message-area">
          <div className="message-container">
            {messages.map(msg => (
              <div key={msg.id} className={`message-row ${msg.role}`}>
                <div className={`bubble ${msg.role}`}>
                  {msg.role === 'assistant' && !msg.content && !msg.isToolUsing && (
                    <span className="thinking">考え中…</span>
                  )}
                  {msg.isToolUsing && (
                    <span className={`tool-status ${msg.toolCompleted ? 'completed' : 'active'}`}>
                      {msg.toolCompleted ? '✓' : '⏳'} {msg.toolName}
                      {msg.toolCompleted ? 'ツールを利用しました' : 'ツールを利用中...'}
                    </span>
                  )}
                  {msg.content && !msg.isToolUsing && <ReactMarkdown>{msg.content}</ReactMarkdown>}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="form-wrapper">
          <form onSubmit={handleSubmit} className="form">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="メッセージを入力..." disabled={loading} className="input" />
            <button type="submit" disabled={loading || !input.trim()} className="button">
              {loading ? '⌛️' : '送信'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
