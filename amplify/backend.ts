import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { createAgentCoreRuntime } from './agent/resource';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Stack } from 'aws-cdk-lib';

// Amplify標準バックエンドのうち、認証機能を利用
const backend = defineBackend({
  auth,
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
  },
});

// WAF設定（IP制限）
// CloudFront用WAFはus-east-1リージョンでのみ作成可能
const wafStack = backend.createStack('WAFStack', {
  env: { region: 'us-east-1' },
});

// 許可するIPアドレスのリスト（CIDR形式）
const allowedIPs = [
//MELCO: 
  '192.218.140.236/32',
  '192.218.140.237/32',
  '192.218.140.238/32',
  '192.218.140.239/32',
  '192.218.140.240/32',
  '192.218.140.241/32',
//MELTEC:
  '210.172.233.198/32',
  '210.172.233.219/32',
  '210.172.233.220/32',
  '203.178.81.200/32',
//AWS: 
  '27.0.3.144/28'
];

const ipSet = new wafv2.CfnIPSet(wafStack, 'AllowedIPSet', {
  scope: 'CLOUDFRONT',
  ipAddressVersion: 'IPV4',
  addresses: allowedIPs,
});

const webAcl = new wafv2.CfnWebACL(wafStack, 'WebACL', {
  scope: 'CLOUDFRONT',
  defaultAction: { block: {} },
  rules: [
    {
      name: 'AllowSpecificIPs',
      priority: 1,
      statement: {
        ipSetReferenceStatement: {
          arn: ipSet.attrArn,
        },
      },
      action: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AllowSpecificIPs',
      },
    },
  ],
  visibilityConfig: {
    sampledRequestsEnabled: true,
    cloudWatchMetricsEnabled: true,
    metricName: 'WebACL',
  },
});

backend.addOutput({
  custom: {
    webAclArn: webAcl.attrArn,
  },
});
