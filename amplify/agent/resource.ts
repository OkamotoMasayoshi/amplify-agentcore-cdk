import { Stack } from 'aws-cdk-lib';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { ContainerImageBuild } from 'deploy-time-build';
import { IUserPool, IUserPoolClient } from 'aws-cdk-lib/aws-cognito';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESMでは__dirnameが使えないため、import.meta.urlから取得
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// AgentCore Runtimeを作成
export function createAgentCoreRuntime(
  stack: Stack,
  userPool: IUserPool,
  userPoolClient: IUserPoolClient
) {
  // CodeBuildでARM64イメージをビルド
  const agentImage = new ContainerImageBuild(stack, 'AgentImage', {
    directory: __dirname,
    platform: Platform.LINUX_ARM64,
  });

  // AgentCore Runtime
  const runtime = new agentcore.Runtime(stack, 'UpdateCheckerRuntime', {
    runtimeName: 'update_checker',
    agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromEcrRepository(
      agentImage.repository,
      agentImage.imageTag
    ),
    authorizerConfiguration: agentcore.RuntimeAuthorizerConfiguration.usingCognito(
      userPool,
      [userPoolClient],
    ),
    networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingPublicNetwork(),
  });

  // Bedrockモデル呼び出し権限
  runtime.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: [
        'arn:aws:bedrock:*::foundation-model/*',
        'arn:aws:bedrock:*:*:inference-profile/*',
      ],
    })
  );

  return { runtime };
}
