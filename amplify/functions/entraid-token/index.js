const https = require('https');

exports.handler = async (event) => {
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

  try {
    // トークン取得
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

    const token = JSON.parse(tokenData);

    // ユーザー情報取得
    const userData = await makeRequest({
      hostname: 'graph.microsoft.com',
      path: '/v1.0/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token.access_token}` },
    });

    const user = JSON.parse(userData);

    return {
      statusCode: 200,
      body: JSON.stringify({
        user: {
          name: user.displayName,
          email: user.mail,
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
