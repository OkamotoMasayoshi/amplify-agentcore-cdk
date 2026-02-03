import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { createAgentCoreRuntime } from './agent/resource';
import { entraidToken } from './functions/entraid-token/resource';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';

// Amplify標準バックエンドのうち、認証機能を利用
const backend = defineBackend({
  auth,
  entraidToken,
});

// API Gateway経由でLambdaを公開
const apiStack = backend.createStack('EntraidApiStack');

const api = new apigateway.RestApi(apiStack, 'EntraidApi', {
  restApiName: 'Entraid Auth API',
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'x-api-key'],
  },
});

const tokenResource = api.root.addResource('token');

// OPTIONSメソッド（CORSプリフライト）
tokenResource.addMethod('OPTIONS', new apigateway.MockIntegration({
  integrationResponses: [{
    statusCode: '200',
    responseParameters: {
      'method.response.header.Access-Control-Allow-Headers': "'Content-Type,x-api-key'",
      'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
      'method.response.header.Access-Control-Allow-Origin': "'*'",
    },
  }],
  requestTemplates: { 'application/json': '{"statusCode": 200}' },
}), {
  methodResponses: [{
    statusCode: '200',
    responseParameters: {
      'method.response.header.Access-Control-Allow-Headers': true,
      'method.response.header.Access-Control-Allow-Methods': true,
      'method.response.header.Access-Control-Allow-Origin': true,
    },
  }],
});

// POSTメソッド
tokenResource.addMethod(
  'POST',
  new apigateway.LambdaIntegration(backend.entraidToken.resources.lambda, {
    proxy: true,
    integrationResponses: [
      {
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      },
    ],
  }),
  {
    apiKeyRequired: true,
    methodResponses: [
      {
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      },
    ],
  }
);

// API KeyとUsage Planを作成
const apiKey = api.addApiKey('EntraidApiKey');
const usagePlan = api.addUsagePlan('EntraidUsagePlan', {
  throttle: { rateLimit: 10, burstLimit: 20 },
});
usagePlan.addApiKey(apiKey);
usagePlan.addApiStage({ stage: api.deploymentStage });

// AgentCore（Amplify標準外）用のCDKスタックを作成
const agentCoreStack = backend.createStack('AgentCoreStack');

// AgentCoreランタイムのリソースを作成
const { runtime } = createAgentCoreRuntime(
  agentCoreStack,
  backend.auth.resources.userPool,
  backend.auth.resources.userPoolClient
);

// ランタイムARNを出力に追加
backend.addOutput({
  custom: {
    agentRuntimeArn: runtime.agentRuntimeArn,
    entraidTokenUrl: `${api.url}token`,
  },
});
