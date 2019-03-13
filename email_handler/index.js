// Exposing dependencies to allow mocking
const deps = {};
deps.AWS = require('aws-sdk');
deps.SNS = new deps.AWS.SNS({apiVersion: '2010-03-31'});
deps.CodePipeline = deps.AWS.CodePipeline;
deps.querystring = require('querystring');
deps.fetch = require('node-fetch');
deps.loadConfig = require('load-config');
deps.log = console.log;
deps.error = console.error;
exports.deps = deps;

const appConfigPath = process.env.APP_CONFIG_PATH;

let config = {};
const requiredConfigKeys = ['targetPipeline', 'approvalApiUrl', 'approvalSnsTopicArn', 'approvers', 'notificationSubject'];

// Posts a message to the SNS approvers topic with links to the API that will either approve/reject the build
const postToApprovers = (event) => {
  const approval = JSON.parse(event.Records[0].Sns.Message).approval;
  const {token, pipelineName, externalEntityLink, customData, actionName, stageName} = approval;
  const baseUrl = `${config.approvalApiUrl}approval?token=${token}&actionName=${actionName}&stageName=${stageName}`
  const approveUrl = `${baseUrl}&action=approve`;
  const rejectUrl = `${baseUrl}&action=reject`;

  const params = {
    Subject: config.notificationSubject,
    Message: `${customData}

    Click here to approve the changes ${approveUrl}

    Or to reject, click here ${rejectUrl}`,
    TopicArn: config.approvalSnsTopicArn,
  };
  const publishTextPromise = deps.SNS.publish(params).promise()
    .then((data) => { deps.log('Publish response:', data); })
    .catch((err) => { deps.error(err, err.stack); });
  return publishTextPromise;
}

// Approve/reject the pipeline for the user. Assumes the token is valid, if not, the pipeline will raise the exception
const putApproval = (event) => {
  const requestParams = event.queryStringParameters;
  const apiUrl = event.requestContext.domainName;
  const action = requestParams.action == 'approve' ? 'Approved' : 'Rejected';
  var params = {
    actionName: requestParams.actionName,
    // Using target pipeline to ensure this only performs approvals for the pipeline it was associated with.
    // We could later make this a more reusable lambda by getting the pipeline name from the SNS event, but
    // for now leaving it this way as an extra way to ensure a user has both the correct API url and token
    // in order to perform approvals.
    pipelineName: config.targetPipeline,
    result: {
      status: action,
      summary: `Approval handled by ${apiUrl}. Approval email was sent to ${config.approvers}`.substring(0, 512) // Prevent length from throwing an exception
    },
    stageName: requestParams.stageName,
    token: requestParams.token,
  };
  const pipeline = new deps.CodePipeline(({ apiVersion: '2015-07-09' }));
  const putPromise = pipeline.putApprovalResult(params).promise()
    .then((data) => { return { "statusCode": 200, "body": `Changes were ${action}.` }; })
    .catch((err) => { deps.error(err); return { "statusCode": 500, "body": err.message }; });
  return putPromise;
}

exports.notifyHandler = async (event) => {
  config = await deps.loadConfig(appConfigPath, requiredConfigKeys);
  return postToApprovers(event);
};

exports.approvalHandler = async (event) => {
  config = await deps.loadConfig(appConfigPath, requiredConfigKeys);
  return putApproval(event);
};
