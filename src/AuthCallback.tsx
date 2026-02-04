import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import outputs from '../amplify_outputs.json';

const LAMBDA_URL = outputs.custom?.entraidTokenUrl;

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (!code || state !== 'aipro-agent-poc') {
        navigate('/');
        return;
      }

      try {
        // LambdaでEntra ID認証 + Cognitoユーザー作成
        const response = await fetch(LAMBDA_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_API_KEY || '',
          },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          console.error('Auth error:', data);
          alert('認証に失敗しました');
          navigate('/');
          return;
        }

        // CognitoセッションをAmplifyに設定
        const { cognitoTokens } = data;
        
        // セッション保存
        localStorage.setItem('entraidUser', JSON.stringify(data.user));
        localStorage.setItem('cognitoTokens', JSON.stringify(cognitoTokens));
        
        // ページリロードでAmplifyがトークンを読み込む
        window.location.href = '/';
      } catch (error) {
        console.error('Auth error:', error);
        alert(`認証エラー: ${error instanceof Error ? error.message : String(error)}`);
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate]);

  return <div>認証中...</div>;
}
