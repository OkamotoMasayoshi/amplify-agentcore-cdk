import { defineAuth } from '@aws-amplify/backend';

// 認証設定（メールアドレスでログイン + Entra ID連携）
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      oidc: [
        {
          name: 'EntraID',
          clientId: process.env.VITE_ENTRAID_CLIENT_ID!,
          clientSecret: process.env.CLIENT_SECRET!,
          issuerUrl: `https://login.microsoftonline.com/${process.env.VITE_ENTRAID_TENANT_ID}/v2.0`,
        },
      ],
      logoutUrls: [process.env.VITE_REDIRECT_URI!],
      callbackUrls: [process.env.VITE_REDIRECT_URI!],
    },
  },
});
