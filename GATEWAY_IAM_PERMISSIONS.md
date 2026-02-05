# AgentCore Gateway IAM権限

## 必要な権限

### 1. Trust Policy (信頼ポリシー)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "bedrock-agentcore.amazonaws.com"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "aws:SourceAccount": "978594444268"
        },
        "ArnLike": {
          "aws:SourceArn": "arn:aws:bedrock-agentcore:ap-northeast-1:978594444268:gateway/*"
        }
      }
    }
  ]
}
```

### 2. Lambda呼び出し権限

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:ap-northeast-1:978594444268:function:GraphAPICalendar"
    }
  ]
}
```

### 3. Lambda側のResource-based Policy

Lambda関数に以下のポリシーを追加:

```json
{
  "Effect": "Allow",
  "Principal": {
    "Service": "bedrock-agentcore.amazonaws.com"
  },
  "Action": "lambda:InvokeFunction",
  "Resource": "arn:aws:lambda:ap-northeast-1:978594444268:function:GraphAPICalendar",
  "Condition": {
    "StringEquals": {
      "AWS:SourceAccount": "978594444268"
    },
    "ArnLike": {
      "AWS:SourceArn": "arn:aws:bedrock-agentcore:ap-northeast-1:978594444268:gateway/*"
    }
  }
}
```

---

## コンソールでの設定手順

### Gateway作成時

1. **Service role**: "Create and use a new service role" を選択
2. AgentCoreが自動的に必要な権限を持つロールを作成

### 手動でロール作成する場合

1. IAM → Roles → Create role
2. Trusted entity: Custom trust policy
3. 上記のTrust Policyを貼り付け
4. Permissions: Lambda呼び出し権限を追加
5. Role name: `AgentCoreGatewayServiceRole`

### Lambda関数への権限追加

```bash
aws lambda add-permission \
  --function-name GraphAPICalendar \
  --statement-id AllowAgentCoreGateway \
  --action lambda:InvokeFunction \
  --principal bedrock-agentcore.amazonaws.com \
  --source-account 978594444268 \
  --source-arn "arn:aws:bedrock-agentcore:ap-northeast-1:978594444268:gateway/*" \
  --region ap-northeast-1
```

---

## 推奨: コンソールで自動作成

最も簡単な方法は、Gateway作成時に **"Create and use a new service role"** を選択することです。
AgentCoreが自動的に必要な権限を設定します。
