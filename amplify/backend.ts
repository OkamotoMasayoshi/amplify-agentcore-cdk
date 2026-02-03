import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { createAgentCoreRuntime } from './agent/resource';
import { entraidToken } from './functions/entraid-token/resource';
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

const backend = defineBackend({
  auth,
  entraidToken,
});

// HTTP API (API Gateway v2) でLambdaを公開
const apiStack = backend.createStack('EntraidApiStack');

const httpApi = new HttpApi(apiStack, 'EntraidHttpApi', {
  corsPreflight: {
    allowOrigins: ['*'],
    allowMethods: [CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
    allowHeaders: ['*'],
  },
});

const integration = new HttpLambdaIntegration(
  'EntraidTokenIntegration',
  backend.entraidToken.resources.lambda
);

httpApi.addRoutes({
  path: '/token',
  methods: [HttpMethod.POST],
  integration,
});

// AgentCore用のCDKスタックを作成
const agentCoreStack = backend.createStack('AgentCoreStack');

const { runtime } = createAgentCoreRuntime(
  agentCoreStack,
  backend.auth.resources.userPool,
  backend.auth.resources.userPoolClient
);

backend.addOutput({
  custom: {
    agentRuntimeArn: runtime.agentRuntimeArn,
    entraidTokenUrl: `${httpApi.url}token`,
  },
});
