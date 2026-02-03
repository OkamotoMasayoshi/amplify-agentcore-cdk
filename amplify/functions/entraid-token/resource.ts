import { defineFunction } from '@aws-amplify/backend';

export const entraidToken = defineFunction({
  name: 'entraid-token',
  entry: './index.mjs',
  runtime: 20,
  timeoutSeconds: 30,
  environment: {
    CLIENT_ID: process.env.CLIENT_ID || '',
    CLIENT_SECRET: process.env.CLIENT_SECRET || '',
    TENANT_ID: process.env.TENANT_ID || '',
    REDIRECT_URI: process.env.REDIRECT_URI || '',
  },
});
