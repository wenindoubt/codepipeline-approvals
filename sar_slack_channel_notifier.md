# Slack Approval Bot

Allows users to perform manual reviews of a CodePipeline deployment and approve or reject the deployment through Slack interactions.

## How it works

Let's say that you make a CodePipeline with an Approval action such as in this CloudFormation snippet:

```yaml
Name: "ManualApproval"
ActionTypeId:
  Owner: AWS
  Category: Approval
  Provider: Manual
  Version: "1"
Configuration:
  NotificationArn: !Ref MyApproversSNSTopic
  CustomData: "Approval1: A new version of dummy application has been deployed to https://www.google.com?q=test. Once approved, these changes will be deployed to https://www.google.com?q=prod"
```

The bot will subscribe to the associated approvers topic, and any time the pipeline reaches the approval action the bot will notify your Slack channel with an interactive message that can be used to approve or reject, ex:

![approval_example](https://github.com/ndlib/codepipeline-approvals/raw/master/slack_approval_example.gif)

**Note**: This bot relies upon Slack for authentication and authorization. It assumes that a user can approve/reject a deployment if they can access the channel associated with approval notification. Make sure to manage your channel permissions appropriately.

## How is this organized

This bot is organized into three pieces:

1. [Approval API](https://console.aws.amazon.com/lambda/home#/create/app?applicationId=arn:aws:serverlessrepo:us-east-1:230391840102:applications/Slack-Approval-Bot) - Handles approving the associated pipeline when a user clicks the buttons in Slack. You will need one of these per [Slack app](https://api.slack.com/slack-apps) (most users will only need one per AWS Account).
1. [Channel Notifier](https://console.aws.amazon.com/lambda/home#/create/app?applicationId=arn:aws:serverlessrepo:us-east-1:230391840102:applications/Slack-Approval-Bot-Notifier) (you are here) - Posts interactive messages to a Slack channel when associated Pipelines reach the Approval stage. You will need one of these per Slack Channel used for approvals.
1. [Pipeline Attachment](https://github.com/ndlib/codepipeline-approvals/blob/master/slack_pipeline_attachment.yaml) - Connects a CodePipeline Approval stage with a [Channel Notifier](https://console.aws.amazon.com/lambda/home#/create/app?applicationId=arn:aws:serverlessrepo:us-east-1:230391840102:applications/Slack-Approval-Bot-Notifier). You will need one of these per Pipeline per Slack Channel.

## Deploy the Channel Notifier

### Step 1: Add an Incoming Webhook for your Channel

Before your notifier can post interactive messages to Slack, you'll need to create an [Incoming Webhook](https://api.slack.com/messaging/webhooks). Make a note of the Webhook URL.

### Step 2: Add your Slack application secrets

Once your webhook is created, you'll need to share the Incoming Webhook URL and App's Verification Token to the notifier. Add the following SSM parameter keys to a path of your choice:

| Key | Description | Example Create |
|----|-----------|------ |
|verificationToken|The verification token for your Slack application. See https://api.slack.com/events-api#url_verification|aws ssm put-parameter --type 'SecureString' --name '/all/slack-approval-bot/verificationToken' --value 'myVerificationToken'|
|webhookUrl|The incoming webhook URL for your Slack channel. See https://api.slack.com/incoming-webhooks|aws ssm put-parameter --cli-input-json '{ "Name": "/all/slack-approval-bot/webhookUrl", "Value": "https://myWebhookUrl", "Type": "SecureString" }'|
|mentions|Additional string to use for mentions as part of the notification. Mentions will be included after the 'Do you approve these changes?' prompt. See https://api.slack.com/docs/message-formatting#linking_to_channels_and_users for more information|aws ssm put-parameter --type 'String' --name '/all/slack-approval-bot/mentions' --value '<@U024BE7LH>'|

### Step 3: Deploy the Notifier Lambda

Now that your secrets are created, deploy this application and make sure to give it the `AppConfigPath` using the parent path from Step 1. For example, if you followed the example commands above, you would set `AppConfigPath` to `/all/slack-approval-bot`.

### What's next

You should now have a fully functioning bot. All that's left is to subscribe the Notifier Lambda to your pipeline's approval step via an SNS Topic. This needs to be done for each CodePipeline that you create, so how you do this depends on how you deploy your pipelines. If you have existing pipelines that you want to connect to your bot, you can do so with the [Slack Pipeline Attachment](https://github.com/ndlib/codepipeline-approvals/blob/master/slack_pipeline_attachment.yaml) template from the source repository for this bot. If you use cdk, we also have a `SlackApproval` Construct that can be used from our [ndlib-cdk](https://github.com/ndlib/ndlib-cdk) project.
