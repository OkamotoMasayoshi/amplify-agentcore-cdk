import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithRedirect } from 'aws-amplify/auth';
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
        // Lambdaでトークン交換
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

        // Entra IDトークンでCognito認証
        await signInWithRedirect({
          provider: { custom: 'EntraID' },
          customState: data.id_token,
        });
      } catch (error) {
        console.error('Auth error:', error);
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate]);

  return <div>認証中...</div>;
}
