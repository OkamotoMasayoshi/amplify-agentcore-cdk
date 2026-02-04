import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { createAgentCoreRuntime } from './agent/resource';
import { createAgentCoreGateway } from './gateway/resource';
import { entraidToken } from './functions/entraid-token/resource';
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  entraidToken,
});

// LambdaにCognito権限付与
backend.entraidToken.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminSetUserPassword',
      'cognito-idp:AdminInitiateAuth',
    ],
    resources: [backend.auth.resources.userPool.userPoolArn],
  })
);

// Lambdaに環境変数追加
backend.entraidToken.addEnvironment('USER_POOL_ID', backend.auth.resources.userPool.userPoolId);
backend.entraidToken.addEnvironment('USER_POOL_CLIENT_ID', backend.auth.resources.userPoolClient.userPoolClientId);

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

const { gateway } = createAgentCoreGateway(
  agentCoreStack,
  backend.auth.resources.userPool,
  backend.auth.resources.userPoolClient
);

backend.addOutput({
  custom: {
    agentRuntimeArn: runtime.agentRuntimeArn,
    gatewayArn: gateway.gatewayArn,
    entraidTokenUrl: `${httpApi.url}token`,
  },
});
