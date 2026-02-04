import { Stack } from 'aws-cdk-lib';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { IUserPool, IUserPoolClient } from 'aws-cdk-lib/aws-cognito';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

export function createAgentCoreGateway(
  stack: Stack,
  userPool: IUserPool,
  userPoolClient: IUserPoolClient
) {
  // 既存のGraphAPICalendar Lambda関数を参照
  const graphCalendarFunction = lambda.Function.fromFunctionName(
    stack,
    'GraphAPICalendar',
    'GraphAPICalendar'
  );

  // ツールスキーマを読み込み
  const toolSchemaPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'tool-schema.json'
  );
  const toolSchemaJson = JSON.parse(fs.readFileSync(toolSchemaPath, 'utf-8'));

  // AgentCore Gatewayを作成
  const gateway = new agentcore.Gateway(stack, 'GraphCalendarGateway', {
    gatewayName: `graph_calendar_gateway_${stack.stackName.slice(-10)}`,
    description: 'Microsoft Graph Calendar Tools for AI Agents',
    authorizerConfiguration: agentcore.GatewayAuthorizer.usingCognito({
      userPool: userPool,
      allowedClients: [userPoolClient],
    }),
  });

  // Lambda Targetを追加
  gateway.addLambdaTarget('CalendarTools', {
    gatewayTargetName: 'calendar-tools',
    description: 'Microsoft Graph Calendar API Tools',
    lambdaFunction: graphCalendarFunction,
    toolSchema: agentcore.ToolSchema.fromInline(toolSchemaJson),
  });

  return { gateway };
}
