import { defineAuth, secret } from '@aws-amplify/backend';

// 認証設定（メールアドレスでログイン + Entra ID OIDC連携）
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      oidc: [
        {
          name: 'EntraID',
          clientId: secret('VITE_ENTRAID_CLIENT_ID'),
          clientSecret: secret('CLIENT_SECRET'),
          issuerUrl: `https://login.microsoftonline.com/${process.env.VITE_ENTRAID_TENANT_ID}/v2.0`,
          scopes: ['openid', 'email', 'profile'],
        },
      ],
      callbackUrls: ['http://localhost:5173/', 'https://main.d140sx6vojtcq1.amplifyapp.com/'],
      logoutUrls: ['http://localhost:5173/', 'https://main.d140sx6vojtcq1.amplifyapp.com/'],
    },
  },
});
