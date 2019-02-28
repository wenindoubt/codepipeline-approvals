'use strict';
const index = require('../../index.js');
const subject = index.notifyHandler;
const helpers = require('../helpers.js');
const chai = helpers.chai,
      should = helpers.chai.should(),
      expect = helpers.chai.expect,
      randString = helpers.randString;

// Creates a test event that looks like the events we will receive from SNS when the
// pipeline has reached the ManualApproval stage
const newNotifySNSEvent = (options = { token: null, pipelineName: null, pipelineRegion: null, stageName: null, actionName: null, customData: null }) => {
  const { token, pipelineName, pipelineRegion, stageName, actionName, customData } = options;
  return {
    "Records": [
        {
            "EventSource": "aws:sns",
            "EventVersion": "1.0",
            "EventSubscriptionArn": "EventSubscriptionArnValue",
            "Sns": {
                "Type": "TypeValue",
                "MessageId": "MessageIdValue",
                "TopicArn": "TopicArnValue",
                "Subject": "SubjectValue",
                "Message": `{"region":"${pipelineRegion}","consoleLink":"consoleLinkValue","approval":{"pipelineName":"${pipelineName}","stageName":"${stageName}","actionName":"${actionName}","token":"${token}","expires":"expiresValue","externalEntityLink":"externalEntityLinkValue","approvalReviewLink":"approvalReviewLinkValue","customData":"${customData}"}}`,
                "Timestamp": "TimestampValue",
                "SignatureVersion": "SignatureVersionValue",
                "Signature": "SignatureValue",
                "SigningCertUrl": "SigningCertUrlValue",
                "UnsubscribeUrl": "UnsubscribeUrlValue",
                "MessageAttributes": {}
            }
        }
    ]
  };
};

describe('notify handler', _ => {
  beforeEach(() => {
    // Kill logging output of the function for cleaner test output.
    // You may need to disable this while iterating on tests
    //chai.spy.on(index.deps, 'log', msg => console.log(msg));
    chai.spy.on(index.deps, 'log', _ => null);
    //chai.spy.on(index.deps, 'error', msg => console.log(msg));
    chai.spy.on(index.deps, 'error', _ => null);
  });

  afterEach(() => {
    chai.spy.restore();
    // Just an extra precaution to ensure spies are written correctly so that they can be restored
    // Note: This only protects against improperly created spies. It won't catch direct reassignment of deps,
    // so make sure we only use spies for index.deps
    Object.keys(index.deps).forEach(key => expect(index.deps[key]).not.to.be.spy)
  });

  it('posts to the Slack webhookUrl defined in the config loaded from parameter store', async () => {
    const expectedUrl = randString();
    chai.spy.on(index.deps, 'fetch', _ => Promise.resolve({ text: _ => 'mock fetch response'}));
    chai.spy.on(index.deps, 'loadConfig', _ => ({ webhookUrl: expectedUrl }));
    const event = newNotifySNSEvent();
    const result = await subject(event);
    expect(index.deps.fetch).to.have.been.called.with(expectedUrl);
  });

  it('adds mentions defined in the config loaded from parameter store', async () => {
    const expectedMentions = randString();
    chai.spy.on(index.deps, 'fetch', (url, params) => {
      expect(params.body).to.include(expectedMentions);
      return Promise.resolve({ text: _ => 'mock fetch response'})
    });
    chai.spy.on(index.deps, 'loadConfig', _ => ({ mentions: expectedMentions }));
    const event = newNotifySNSEvent();
    const result = await subject(event);
    expect(index.deps.fetch).to.have.been.called();
  });

  it('adds actions compatible with the approval lambda using data from the SNS approval event', async () => {
    const mockSnsData = {
      token: randString(),
      pipelineName: randString(),
      pipelineRegion: randString(),
      stageName: randString(),
      actionName: randString(),
    };
    chai.spy.on(index.deps, 'fetch', (url, params) => {
      const fetchBody = JSON.parse(params.body);
      fetchBody.attachments.should.include.something.like({
        actions: [
          { value: `{\"approve\": \"True\", \"token\": \"${mockSnsData.token}\", \"codePipelineName\": \"${mockSnsData.pipelineName}\", \"codePipelineRegion\": \"${mockSnsData.pipelineRegion}\", \"stageName\":\"${mockSnsData.stageName}\", \"actionName\": \"${mockSnsData.actionName}\"}` },
          { value: `{\"approve\": \"False\", \"token\": \"${mockSnsData.token}\", \"codePipelineName\": \"${mockSnsData.pipelineName}\", \"codePipelineRegion\": \"${mockSnsData.pipelineRegion}\", \"stageName\":\"${mockSnsData.stageName}\", \"actionName\": \"${mockSnsData.actionName}\"}` }
        ]
      });
      return Promise.resolve({ text: _ => 'mock fetch response'});
    });
    chai.spy.on(index.deps, 'loadConfig', _ => ({ mentions: null }));
    const event = newNotifySNSEvent(mockSnsData);
    const result = await subject(event);
    expect(index.deps.fetch).to.have.been.called();
  });

  it('logs the response on successfully posting to Slack', async () => {
    chai.spy.on(index.deps, 'fetch', _ => Promise.resolve({ text: _ => 'mock fetch response'}));
    chai.spy.on(index.deps, 'loadConfig', _ => ({}));
    const event = newNotifySNSEvent();
    const result = await subject(event);
    expect(index.deps.log).to.have.been.called.with('mock fetch response');
  });

  it('logs an error if it fails to post to Slack', async () => {
    const mockError = new Error('fetch error');
    chai.spy.on(index.deps, 'fetch', _ => Promise.reject(mockError));
    chai.spy.on(index.deps, 'loadConfig', _ => ({}));
    const event = newNotifySNSEvent();
    const result = await subject(event);
    expect(index.deps.error).to.have.been.called.with(mockError);
  });
});
