# CodePipeline Approvals
Provides extra integrations with CodePipeline Manual Approval stages. Currently supports two types of integrations:
* [Email](email_approval.md) - Approvers receive an email with links to directly approve/reject a pipeline.
* [Slack](slack_approval.md) - Approvers receive an interactive message in Slack to approve/reject a pipeline.


## Contributing
If you're iterating on the code in this repo, the example_pipeline.yml can create a dummy pipeline that you can use for testing:
```console
aws cloudformation deploy \
  --region my-region \
  --stack-name approvals-example-pipeline \
  --template-file example_pipeline.yml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides GithubOAuth=$oauth
```
