# Slack Approval
Allows users to perform manual reviews of a CodePipeline deployment and approve or reject the deployment through Slack interactions.

## How it works
You make a pipeline with an Approval action:
```
Name: "ManualApproval"
ActionTypeId:
  Owner: AWS
  Category: Approval
  Provider: Manual
  Version: "1"
Configuration:
  NotificationArn: !Ref MyApproversSNSTopic
  CustomData: "My approval message"
```
Using this, you can deploy this slack approval service that will subscribe to the approvers topic. Any time the pipeline reaches the approval action, the service will notify your Slack channel with an interactive message that can be used to approve or reject, ex:

TODO: Add screenshot

Note: The current implementation relies upon Slack for authentication and authorization. It assumes that a user can approve/reject a deployment if they can access the channel associated with the incoming Webhook URL.

## Requirements
- yarn and node 8.10 or greater
- [aws-cli](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
- A CodePipeline stack that exports PipelineName
- A [Slack app](https://api.slack.com/slack-apps) with an incoming webhook and interactivity enabled

The following SSM parameter keys to exist within your AppConfigPath:

| Key | Description | Example Create |
|----|-----------|------ |
|verificationToken|The verification token for your Slack application. See https://api.slack.com/events-api#url_verification|aws ssm put-parameter --type 'SecureString' --name '/all/cd-approvals/slack/verificationToken' --value 'myVerificationToken'|
|webhookUrl|The incoming webhook URL for your Slack application. See https://api.slack.com/incoming-webhooks|aws ssm put-parameter --type 'SecureString' --name '/all/cd-approvals/slack/webhookUrl' --value 'myWebhookUrl'|
|mentions|Additional string to use for mentions as part of the notification. Mentions will be included after the 'Do you approve these changes?' prompt. See https://api.slack.com/docs/message-formatting#linking_to_channels_and_users for more information|aws ssm put-parameter --type 'String' --name '/all/cd-approvals/slack/mentions' --value '<@U024BE7LH>'|


## Test
Install development dependencies and run tests:
```console
cd slack_handler
yarn install
yarn test
```

## Deploy
1. Install dependencies
```console
cd slack_handler
yarn install --production
```
2. Package the lambda and copy it to your code bucket:
```console
aws cloudformation package \
    --template-file slack_approval.yaml \
    --output-template-file slack_approval_packaged.yaml \
    --s3-bucket my-code-bucket-name
```
3. Deploy the output packaged.yaml template:
```console
aws cloudformation deploy \
  --capabilities CAPABILITY_IAM \
  --template-file slack_approval_packaged.yaml \
  --region my-region \
  --stack-name appname-pipeline-slack-approval \
  --parameter-overrides PipelineExportName='appname-pipeline-prep:PipelineName' AppConfigPath="/all/appname/cd-approvals/prep" \
    SNSTopicExportName='appname-pipeline-prep:Approvers1Topic' Approvers='approvers@mydomain.com' NotificationSubject='Appname requires your approval'
```
*Note: In the above command, you can optionally directly specify the pipeline name with the PipelineName parameter. If both are given, it will use the PipelineExportName over the given PipelineName since an export from a stack is less likely to be incorrect.*

TODO: Add Slack App configuration steps
