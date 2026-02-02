import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { createAgentCoreRuntime } from './agent/resource';
import { entraidToken } from './functions/entraid-token/resource';

// Amplify標準バックエンドのうち、認証機能を利用
const backend = defineBackend({
  auth,
  entraidToken,
});

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
    entraidTokenUrl: entraidToken.resources.lambda.functionUrl,
  },
});
