import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { GetIdCommand, GetCredentialsForIdentityCommand } from '@aws-sdk/client-cognito-identity';
import outputs from '../amplify_outputs.json';

const LAMBDA_URL = outputs.custom?.entraidTokenUrl;
const IDENTITY_POOL_ID = (outputs.custom as any)?.identityPoolId;
const REGION = 'ap-northeast-1';

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

        // Cognito Identity PoolでAWS認証情報取得
        const cognitoClient = new CognitoIdentityClient({ region: REGION });
        
        const getIdResponse = await cognitoClient.send(
          new GetIdCommand({
            IdentityPoolId: IDENTITY_POOL_ID,
            Logins: {
              [`login.microsoftonline.com/${import.meta.env.VITE_ENTRAID_TENANT_ID}/v2.0`]: data.id_token,
            },
          })
        );

        const credsResponse = await cognitoClient.send(
          new GetCredentialsForIdentityCommand({
            IdentityId: getIdResponse.IdentityId,
            Logins: {
              [`login.microsoftonline.com/${import.meta.env.VITE_ENTRAID_TENANT_ID}/v2.0`]: data.id_token,
            },
          })
        );

        // セッション保存
        localStorage.setItem('entraidUser', JSON.stringify(data.user));
        localStorage.setItem('awsCredentials', JSON.stringify(credsResponse.Credentials));
        
        navigate('/');
      } catch (error) {
        console.error('Auth error:', error);
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate]);

  return <div>認証中...</div>;
}
