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

1. [Approval API](https://console.aws.amazon.com/lambda/home#/create/app?applicationId=arn:aws:serverlessrepo:us-east-1:230391840102:applications/Slack-Approval-Bot) (you are here) - Handles approving the associated pipeline when a user clicks the buttons in Slack. You will need one of these per [Slack app](https://api.slack.com/slack-apps) (most users will only need one per AWS Account).
1. [Channel Notifier](https://console.aws.amazon.com/lambda/home#/create/app?applicationId=arn:aws:serverlessrepo:us-east-1:230391840102:applications/Slack-Approval-Bot-Notifier) - Posts interactive messages to a Slack channel when associated Pipelines reach the Approval stage. You will need one of these per Slack Channel used for approvals.
1. [Pipeline Attachment](https://github.com/ndlib/codepipeline-approvals/blob/master/slack_pipeline_attachment.yaml) - Connects a CodePipeline Approval stage with a [Channel Notifier](https://console.aws.amazon.com/lambda/home#/create/app?applicationId=arn:aws:serverlessrepo:us-east-1:230391840102:applications/Slack-Approval-Bot-Notifier). You will need one of these per Pipeline per Slack Channel.

## Deploy this API

### Step 1: Create your Slack application

Before you can deploy your bot, you'll need to create your [Slack app](https://api.slack.com/slack-apps). Make a note of your application's verification token.

### Step 2: Add your Slack application secrets

Once your application is created, you'll need to share your verification token to the bot. Add the following SSM parameter keys to a path of your choice:

| Key | Description | Example Create |
|----|-----------|------ |
|verificationToken|The verification token for your Slack application. See https://api.slack.com/events-api#url_verification|aws ssm put-parameter --type 'SecureString' --name '/all/slack-approval-bot/verificationToken' --value 'myVerificationToken'|

### Step 3: Deploy the Approval API

Now that your Slack app and secrets are created, deploy this application and make sure to give it the `AppConfigPath` using the parent path from Step 2. For example, if you followed the example commands above, you would set `AppConfigPath` to `/all/slack-approval-bot`.

### Step 4: Configure Slack to post to your API

Go to your Slack App configuration and turn on interactivity (see https://api.slack.com/messaging/interactivity#components). Populate the Request URL with `https://<approval-api-endpoint>/approval`. Ex: `https://abc123.execute-api.us-east-1.amazonaws.com/Prod/approval`.

### What's next

Now that you have an Approval API and a Slack App that's configured to post to that API, you'll need to configure your bot to start sending interactive messages to a Slack channel when a pipeline reaches approval. To do this, create a [Channel Notifier](https://console.aws.amazon.com/lambda/home#/create/app?applicationId=arn:aws:serverlessrepo:us-east-1:230391840102:applications/Slack-Approval-Bot-Notifier).
