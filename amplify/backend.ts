import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { createAgentCoreRuntime } from './agent/resource';
import { entraidToken } from './functions/entraid-token/resource';
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { CfnIdentityPool, CfnIdentityPoolRoleAttachment } from 'aws-cdk-lib/aws-cognito';
import { FederatedPrincipal, Role, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

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

// Identity Pool作成
const identityPool = new CfnIdentityPool(apiStack, 'EntraidIdentityPool', {
  allowUnauthenticatedIdentities: false,
  openIdConnectProviderArns: [],
  supportedLoginProviders: {
    'sts.windows.net': process.env.VITE_ENTRAID_CLIENT_ID!,
  },
});

// Identity Pool用のIAMロール
const authenticatedRole = new Role(apiStack, 'EntraidAuthenticatedRole', {
  assumedBy: new FederatedPrincipal(
    'cognito-identity.amazonaws.com',
    {
      StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
      'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' },
    },
    'sts:AssumeRoleWithWebIdentity'
  ),
});

authenticatedRole.addToPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeAgent'],
    resources: ['*'],
  })
);

new CfnIdentityPoolRoleAttachment(apiStack, 'IdentityPoolRoleAttachment', {
  identityPoolId: identityPool.ref,
  roles: {
    authenticated: authenticatedRole.roleArn,
  },
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
    identityPoolId: identityPool.ref,
  },
});
