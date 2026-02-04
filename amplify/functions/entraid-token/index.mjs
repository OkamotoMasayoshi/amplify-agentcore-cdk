import https from 'https';

export const handler = async (event) => {
  const { code } = JSON.parse(event.body || '{}');
  
  if (!code) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'code is required' }),
    };
  }

  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const TENANT_ID = process.env.TENANT_ID;
  const REDIRECT_URI = process.env.REDIRECT_URI;
  const USER_POOL_ID = process.env.USER_POOL_ID;
  const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID;

  try {
    console.log('Token request started');
    const tokenData = await makeRequest({
      hostname: 'login.microsoftonline.com',
      path: `/${TENANT_ID}/oauth2/v2.0/token`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }).toString());

    console.log('Token received');
    const token = JSON.parse(tokenData);

    const userData = await makeRequest({
      hostname: 'graph.microsoft.com',
      path: '/v1.0/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token.access_token}` },
    });

    console.log('User data received');
    const user = JSON.parse(userData);

    // Cognito SDKを動的インポート
    const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminInitiateAuthCommand } = await import('@aws-sdk/client-cognito-identity-provider');
    const cognitoClient = new CognitoIdentityProviderClient({ region: 'ap-northeast-1' });

    // Cognito User Poolにユーザー作成/更新
    const email = user.mail || user.userPrincipalName;
    const username = email; // メールアドレスをそのまま使用

    try {
      await cognitoClient.send(new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: user.displayName },
        ],
        MessageAction: 'SUPPRESS',
      }));
      console.log('User created');
    } catch (error) {
      if (error.name !== 'UsernameExistsException') {
        throw error;
      }
      console.log('User already exists');
    }

    // パスワード設定（ランダム）
    const tempPassword = Math.random().toString(36).slice(-16) + 'A1!';
    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      Password: tempPassword,
      Permanent: true,
    }));

    // Cognitoセッショントークン取得
    const authResult = await cognitoClient.send(new AdminInitiateAuthCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: USER_POOL_CLIENT_ID,
      AuthFlow: 'ADMIN_NO_SRP_AUTH',
      AuthParameters: {
        USERNAME: username,
        PASSWORD: tempPassword,
      },
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        cognitoTokens: authResult.AuthenticationResult,
        user: {
          name: user.displayName,
          email: email,
          department: user.department,
          jobTitle: user.jobTitle,
        },
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
