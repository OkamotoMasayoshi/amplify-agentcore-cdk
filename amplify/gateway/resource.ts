import { Stack } from 'aws-cdk-lib';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { IUserPool, IUserPoolClient } from 'aws-cdk-lib/aws-cognito';

export function createAgentCoreGateway(
  stack: Stack,
  userPool: IUserPool,
  userPoolClient: IUserPoolClient
) {
  const gateway = new agentcore.Gateway(stack, 'GraphCalendarGateway', {
    gatewayName: `graph_calendar_gw`,
    description: 'Microsoft Graph Calendar Tools',
    authorizerConfiguration: agentcore.GatewayAuthorizer.usingCognito({
      userPool: userPool,
      allowedClients: [userPoolClient],
    }),
  });

  return { gateway };
}
