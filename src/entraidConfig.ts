export const entraidConfig = {
  clientId: import.meta.env.VITE_ENTRAID_CLIENT_ID || '',
  tenantId: import.meta.env.VITE_ENTRAID_TENANT_ID || '',
  redirectUri: import.meta.env.VITE_REDIRECT_URI || 'https://ktwzohrvmb.execute-api.ap-northeast-1.amazonaws.com/dev/login',
  scope: 'User.Read email profile openid',
  state: 'aipro-agent-poc',
};

export const getAuthUrl = () => {
  const { clientId, tenantId, redirectUri, scope, state } = entraidConfig;
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
    `client_id=${clientId}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scope)}&` +
    `state=${encodeURIComponent(state)}&` +
    `response_mode=query`;
};
