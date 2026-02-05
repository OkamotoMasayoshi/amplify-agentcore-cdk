# AgentCore Gateway コンソール作成手順

## 前提情報

### Cognito User Pool
- **User Pool ID**: `ap-northeast-1_Cir56JeTt`
- **User Pool Name**: `amplifyAuthUserPool4BA7F805-tcuxspyVGDwR`

### Lambda関数
- **Function Name**: `GraphAPICalendar`
- **ARN**: `arn:aws:lambda:ap-northeast-1:978594444268:function:GraphAPICalendar`

---

## 手順1: Gateway作成

1. AWSコンソール → **Amazon Bedrock** → **AgentCore** → **Gateways**
2. **Create gateway** をクリック

### 設定値:
```
Gateway name: graph-calendar-gateway
Description: Microsoft Graph Calendar Tools for AI Agents

Inbound authorization:
  Type: Amazon Cognito
  User Pool: ap-northeast-1_Cir56JeTt
  User Pool Client: (ドロップダウンから選択)
```

3. **Create gateway** をクリック

---

## 手順2: Lambda Target追加

1. 作成したGateway詳細画面 → **Targets** タブ
2. **Add target** をクリック
3. **Lambda function** を選択

### 設定値:
```
Target name: calendar-tools
Description: Microsoft Graph Calendar API Tools
Lambda function: GraphAPICalendar

Tool schema: (以下のJSONを貼り付け)
```

### Tool Schema (コピー用):
```json
[
  {
    "name": "getCalendar",
    "description": "指定期間のカレンダー予定を取得します。ユーザーのメールアドレスと期間を指定してください。",
    "inputSchema": {
      "type": "object",
      "properties": {
        "accessToken": {
          "type": "string",
          "description": "Microsoft Graph APIアクセストークン"
        },
        "userEmail": {
          "type": "string",
          "description": "対象ユーザーのメールアドレス"
        },
        "startDate": {
          "type": "string",
          "description": "開始日時（ISO 8601形式）例: 2024-12-01T00:00:00Z"
        },
        "endDate": {
          "type": "string",
          "description": "終了日時（ISO 8601形式）例: 2024-12-31T23:59:59Z"
        }
      },
      "required": ["accessToken", "userEmail", "startDate", "endDate"]
    }
  },
  {
    "name": "getBusySlots",
    "description": "複数ユーザーの予約済み時間帯を取得します。業務時間（9-12時、13-17時）のみ抽出されます。",
    "inputSchema": {
      "type": "object",
      "properties": {
        "accessToken": {
          "type": "string",
          "description": "Microsoft Graph APIアクセストークン"
        },
        "emails": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "対象ユーザーのメールアドレスリスト"
        },
        "startDate": {
          "type": "string",
          "description": "開始日時（ISO 8601形式）"
        },
        "endDate": {
          "type": "string",
          "description": "終了日時（ISO 8601形式）"
        }
      },
      "required": ["accessToken", "emails", "startDate", "endDate"]
    }
  },
  {
    "name": "createEvent",
    "description": "カレンダーに予定を登録します。Teams会議を付けることも可能です。",
    "inputSchema": {
      "type": "object",
      "properties": {
        "accessToken": {
          "type": "string",
          "description": "Microsoft Graph APIアクセストークン"
        },
        "userEmail": {
          "type": "string",
          "description": "予定を作成するユーザーのメールアドレス"
        },
        "subject": {
          "type": "string",
          "description": "予定のタイトル"
        },
        "startDateTime": {
          "type": "string",
          "description": "開始日時（ISO 8601形式）"
        },
        "endDateTime": {
          "type": "string",
          "description": "終了日時（ISO 8601形式）"
        },
        "requiredAttendees": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "必須参加者のメールアドレスリスト"
        },
        "optionalAttendees": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "任意参加者のメールアドレスリスト"
        },
        "withTeamsMeeting": {
          "type": "boolean",
          "description": "Teams会議を付けるかどうか"
        }
      },
      "required": ["accessToken", "userEmail", "subject", "startDateTime", "endDateTime"]
    }
  }
]
```

4. **Add target** をクリック

---

## 手順3: 確認

### Gateway情報取得:
```bash
aws bedrock-agentcore list-gateways --region ap-northeast-1
```

### Target確認:
```bash
aws bedrock-agentcore list-gateway-targets \
  --gateway-id <GATEWAY_ID> \
  --region ap-northeast-1
```

---

## 完了後の情報

作成完了後、以下の情報を記録:
- Gateway ID: `_________________`
- Gateway ARN: `_________________`
- MCP Endpoint URL: `_________________`
- Target ID: `_________________`
