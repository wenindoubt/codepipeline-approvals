// Exposing dependencies to allow mocking
const deps = {};
deps.AWS = require('aws-sdk');
deps.CodePipeline = deps.AWS.CodePipeline;
deps.querystring = require('querystring');
deps.fetch = require('node-fetch');
deps.loadConfig = require('load-config');
deps.log = console.log;
deps.error = console.error;
exports.deps = deps;

const appConfigPath = process.env.APP_CONFIG_PATH;

let config;
const requiredConfigKeys = ['verificationToken', 'webhookUrl'];

// Posts a message to the SNS approvers topic with links to the API that will either approve/reject the build
const postToApprovers = (event) => {
  //deps.log('postToApprovers', event);
  const snsMessage = JSON.parse(event.Records[0].Sns.Message);
  const pipelineRegion = snsMessage.region;
  const { token, pipelineName, externalEntityLink, customData, actionName, stageName } = snsMessage.approval;

  const mentions = config.mentions ? config.mentions : ''
  const slackMessage = {
    "text": 'A deployment pipeline is awaiting approval:',
    "attachments": [
        {
            "fields": [
              {
                'title': 'Pipeline',
                'value': `<${snsMessage.consoleLink}|${pipelineName}>`
              },
              {
                'title': 'Message',
                'value': customData
              }
            ]
        },
        {
            "fallback": `Do you approve these changes? ${mentions}`,
            "title": `Do you approve these changes? ${mentions}`,
            "callback_id": pipelineName,
            "color": "#3AA3E3",
            "attachment_type": "default",
            "actions": [
                {
                    "name": "approve",
                    "text": "Approve",
                    "style": "danger",
                    "type": "button",
                    "value": `{\"approve\": \"True\", \"token\": \"${token}\", \"codePipelineName\": \"${pipelineName}\", \"codePipelineRegion\": \"${pipelineRegion}\", \"stageName\":\"${stageName}\", \"actionName\": \"${actionName}\"}`
                },
                {
                    "name": "approve",
                    "text": "Reject",
                    "type": "button",
                    "value": `{\"approve\": \"False\", \"token\": \"${token}\", \"codePipelineName\": \"${pipelineName}\", \"codePipelineRegion\": \"${pipelineRegion}\", \"stageName\":\"${stageName}\", \"actionName\": \"${actionName}\"}`
                }
            ]
        }
    ]
  };
  const params = {
    method: 'post',
    body:    JSON.stringify(slackMessage),
    headers: { 'Content-Type': 'application/json' },
  }
  const publishMessagePromise = deps.fetch(config.webhookUrl, params)
      .then(res => res.text())
      .then(json => deps.log('Publish response:', json))
      .catch((err) => { deps.error(err, err.stack); });
  return publishMessagePromise;
}

// Approve/reject the pipeline for the user. Assumes the token is valid, if not, the pipeline will raise the exception
const putApproval = (event) => {
  //deps.log('putApproval', event);
  const body = deps.querystring.parse(event.body);
  const payload = JSON.parse(body.payload);

  // Validate Slack token. TODO: Move to signing secret
  if(config.verificationToken !== payload.token){
    return  {
      "isBase64Encoded": "false",
      "statusCode": 403,
      "body": "{\"error\": \"This request does not include a valid verification token.\"}"
    }
  } else {
    // Process request
    const requestAction = JSON.parse(payload.actions[0].value)
    const action = requestAction.approve === "True" ? 'Approved' : 'Rejected';
    var params = {
      actionName: requestAction.actionName,
      pipelineName: requestAction.codePipelineName,
      result: {
        status: action,
        summary: `${action} by ${payload.user.name} in Slack channel ${payload.channel.name} (${payload.channel.id})`.substring(0, 512) // Prevent length from throwing an exception
      },
      stageName: requestAction.stageName,
      token: requestAction.token,
    };
    const pipeline = new deps.CodePipeline(({ apiVersion: '2015-07-09', region: requestAction.codePipelineRegion }));
    const putPromise = pipeline.putApprovalResult(params).promise()
      .then((data) => { return { "statusCode": 200, "body": `Changes were ${action} by <@${payload.user.id}>.` }; })
      .catch((err) => {
        // We want to handle the already approved error so that we can respond appropriately to the channel
        if(err.statusCode === 400 && err.code === 'ApprovalAlreadyCompletedException')
          return { "statusCode": 200, "body": err.message };
        deps.error(err);
        return { "statusCode": 500, "body": err.message };
      });
    return putPromise;
  }
}

exports.notifyHandler = async (event) => {
  config = await deps.loadConfig(appConfigPath, requiredConfigKeys);
  return postToApprovers(event);
};

exports.approvalHandler = async (event) => {
  config = await deps.loadConfig(appConfigPath, requiredConfigKeys);
  return putApproval(event);
};
