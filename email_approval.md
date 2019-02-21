# Email Approval
Allows users to perform manual reviews of a CodePipeline and approve or reject the deployment through email.

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
Using this, you can deploy this email approval service that will subscribe to the approvers topic. Any time the pipeline reaches the approval action, the service will email your list of approvers with a link that can be used to approve, and another that can be used to reject, ex:
```
Approval1: A new version of dummy application has been deployed to https://www.google.com?q=test. Once approved, these changes will be deployed to https://www.google.com?q=prod

    Click here to approve the changes https://abc123.execute-api.us-west-2.amazonaws.com/Prod/approval?token=one-time-approval-token&actionName=Approval1&stageName=Approval1&action=approve

    Or to reject, click here https://abc123.execute-api.us-west-2.amazonaws.com/Prod/approval?token=one-time-approval-token&actionName=Approval1&stageName=Approval1&action=reject
```

Note: The current implementation does not perform authentication or authorization. It assumes that if you have the approval token, you can approve or reject.

## Requirements
- yarn and node 8.10 or greater
- [aws-cli](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
- A CodePipeline stack that exports PipelineName and an SNS topic to subscribe to

## Test
Install development dependencies and run tests:
```console
cd email_handler
yarn install
yarn test
```

## Deploy
1. Install dependencies
```console
cd email_handler
yarn install --production
```
2. Package the lambda and copy it to your code bucket:
```console
aws cloudformation package \
    --template-file email_approval.yaml \
    --output-template-file email_approval_packaged.yaml \
    --s3-bucket my-code-bucket-name
```
3. Deploy the output packaged.yaml template:
```console
aws cloudformation deploy \
  --capabilities CAPABILITY_IAM \
  --template-file email_approval_packaged.yaml \
  --region my-region \
  --stack-name appname-pipeline-email-approval \
  --parameter-overrides PipelineExportName='appname-pipeline-prep:PipelineName' AppConfigPath="/all/appname/cd-approvals/prep" \
    SNSTopicExportName='appname-pipeline-prep:Approvers1Topic' Approvers='approvers@mydomain.com' NotificationSubject='Appname requires your approval'
```
*Note: In the above command, you can optionally directly specify the pipeline name with the PipelineName parameter. If both are given, it will use the PipelineExportName over the given PipelineName since an export from a stack is less likely to be incorrect.*
