const AWS = require('aws-sdk');
const fetch = require('node-fetch');
const querystring = require('querystring');
const loadConfig = require('load-config');
const appConfigPath = process.env.APP_CONFIG_PATH;

let config;
const requiredConfigKeys = ['pipelineName', 'verificationToken', 'webhookUrl'];

// Posts a message to the SNS approvers topic with links to the API that will either approve/reject the build
const postToApprovers = (event) => {
  //console.log('postToApprovers', event);
  const snsMessage = JSON.parse(event.Records[0].Sns.Message);
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
                    "value": `{\"approve\": \"True\", \"token\": \"${token}\", \"codePipelineName\": \"${pipelineName}\", \"stageName\":\"${stageName}\", \"actionName\": \"${actionName}\"}`
                },
                {
                    "name": "approve",
                    "text": "Reject",
                    "type": "button",
                    "value": `{\"approve\": \"False\", \"token\": \"${token}\", \"codePipelineName\": \"${pipelineName}\", \"stageName\":\"${stageName}\", \"actionName\": \"${actionName}\"}`
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
  const publishMessagePromise = fetch(config.webhookUrl, params)
      .then(res => res.text())
      .then(json => console.log('Publish response:', json))
      .catch((err) => { console.error(err, err.stack); });
  return publishMessagePromise;
}

// Approve/reject the pipeline for the user. Assumes the token is valid, if not, the pipeline will raise the exception
const putApproval = (event) => {
  //console.log('putApproval', event);
  const apiUrl = event.requestContext.domainName;
  const body = querystring.parse(event.body);
  const payload = JSON.parse(body.payload);

  // Validate Slack token. TODO: Move to signing secret
  if(config.verificationToken != payload.token){
    return  {
      "isBase64Encoded": "false",
      "statusCode": 403,
      "body": "{\"error\": \"This request does not include a valid verification token.\"}"
    }
  } else {
    // Process request
    const requestAction = JSON.parse(payload.actions[0].value)
    const action = requestAction.approve == "True" ? 'Approved' : 'Rejected';
    var params = {
      actionName: requestAction.actionName,
      // Using target pipeline to ensure this only performs approvals for the pipeline it was associated with.
      // We could later make this a more reusable lambda by getting the pipeline name from the SNS event, but
      // for now leaving it this way as an extra way to ensure a user has both the correct API url and token
      // in order to perform approvals.
      pipelineName: config.pipelineName,
      result: {
        status: action,
        summary: `${action} by ${payload.user.name} in Slack channel ${payload.channel.name} (${payload.channel.id})`.substring(0, 512) // Prevent length from throwing an exception
      },
      stageName: requestAction.stageName,
      token: requestAction.token,
    };
    const putPromise = new AWS.CodePipeline({apiVersion: '2015-07-09'}).putApprovalResult(params).promise()
      .then((data) => { return { "statusCode": 200, "body": `Changes were ${action} by <@${payload.user.id}>.` }; })
      .catch((err) => {
        // We want to handle the already approved error so that we can respond appropriately to the channel
        if(err.statusCode == 400 && err.code == 'ApprovalAlreadyCompletedException')
          return { "statusCode": 200, "body": err.message };
        console.error(err);
        return { "statusCode": 500, "body": err.message };
      });
    return putPromise;
  }
}

exports.notifyHandler = async (event) => {
  config = await loadConfig(appConfigPath, requiredConfigKeys);
  return postToApprovers(event);
};

exports.approvalHandler = async (event) => {
  config = await loadConfig(appConfigPath, requiredConfigKeys);
  return putApproval(event);
};
