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
const newNotifySNSEvent = (options = { token: null, pipelineName: null, stageName: null, actionName: null, customData: null }) => {
  const { token, pipelineName, stageName, actionName, customData } = options;
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
                "Message": `{"region":"regionValue","consoleLink":"consoleLinkValue","approval":{"pipelineName":"${pipelineName}","stageName":"${stageName}","actionName":"${actionName}","token":"${token}","expires":"expiresValue","externalEntityLink":"externalEntityLinkValue","approvalReviewLink":"approvalReviewLinkValue","customData":"${customData}"}}`,
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

  it('posts to the SNS topic defined in the config loaded from parameter store', async () => {
    const expectedTopic = randString();
    chai.spy.on(index.deps.SNS, 'publish', (params) => {
      expect(params).to.include({ TopicArn: expectedTopic });
      return { promise: _ => Promise.resolve() };
    });
    chai.spy.on(index.deps, 'loadConfig', _ => ({ approvalSnsTopicArn: expectedTopic }));
    const event = newNotifySNSEvent();
    const result = await subject(event);
    expect(index.deps.SNS.publish).to.have.been.called();
  });

  it('adds token to query string in both API links using data from the SNS approval event', async () => {
    const mockSnsData = {
      token: randString(),
      stageName: randString(),
      actionName: randString(),
    };
    const mockApiUrl = `https://${randString()}?`;
    chai.spy.on(index.deps.SNS, 'publish', (params) => {
      const message = params.Message;
      const paramRe = new RegExp(`${mockApiUrl}.*token=${mockSnsData.token}.*`, 'g');
      expect(message.match(paramRe), 'token not found in query string').to.be.a('Array');
      expect(message.match(paramRe).length, 'token not found in both links').to.eq(2);
      return { promise: _ => Promise.resolve() };
    });
    chai.spy.on(index.deps, 'loadConfig', _ => ({ approvalApiUrl: mockApiUrl }));
    const event = newNotifySNSEvent(mockSnsData);
    const result = await subject(event);
    expect(index.deps.SNS.publish).to.have.been.called();
  });

  it('adds stageName to query string in both API links using data from the SNS approval event', async () => {
    const mockSnsData = {
      token: randString(),
      stageName: randString(),
      actionName: randString(),
    };
    const mockApiUrl = `https://${randString()}?`;
    chai.spy.on(index.deps.SNS, 'publish', (params) => {
      const message = params.Message;
      const paramRe = new RegExp(`${mockApiUrl}.*stageName=${mockSnsData.stageName}.*`, 'g');
      expect(message.match(paramRe), 'stageName not found in query string').to.be.a('Array');
      expect(message.match(paramRe).length, 'stageName not found in both links').to.eq(2);
      return { promise: _ => Promise.resolve() };
    });
    chai.spy.on(index.deps, 'loadConfig', _ => ({ approvalApiUrl: mockApiUrl }));
    const event = newNotifySNSEvent(mockSnsData);
    const result = await subject(event);
    expect(index.deps.SNS.publish).to.have.been.called();
  });

  it('adds actionName to query string in both API links using data from the SNS approval event', async () => {
    const mockSnsData = {
      token: randString(),
      stageName: randString(),
      actionName: randString(),
    };
    const mockApiUrl = `https://${randString()}?`;
    chai.spy.on(index.deps.SNS, 'publish', (params) => {
      const message = params.Message;
      const paramRe = new RegExp(`${mockApiUrl}.*actionName=${mockSnsData.actionName}.*`, 'g');
      expect(message.match(paramRe), 'actionName not found in query string').to.be.a('Array');
      expect(message.match(paramRe).length, 'actionName not found in both links').to.eq(2);
      return { promise: _ => Promise.resolve() };
    });
    chai.spy.on(index.deps, 'loadConfig', _ => ({ approvalApiUrl: mockApiUrl }));
    const event = newNotifySNSEvent(mockSnsData);
    const result = await subject(event);
    expect(index.deps.SNS.publish).to.have.been.called();
  });

  it('adds action=approve to query string in one of the API links', async () => {
    const mockSnsData = {
      token: randString(),
      stageName: randString(),
      actionName: randString(),
    };
    const mockApiUrl = `https://${randString()}?`;
    chai.spy.on(index.deps.SNS, 'publish', (params) => {
      const message = params.Message;
      const paramRe = new RegExp(`${mockApiUrl}.*action=approve.*`, 'g');
      expect(message.match(paramRe), 'action=approve not found in query string').to.be.a('Array');
      expect(message.match(paramRe).length, 'action=approve found in more than one link').to.eq(1);
      return { promise: _ => Promise.resolve() };
    });
    chai.spy.on(index.deps, 'loadConfig', _ => ({ approvalApiUrl: mockApiUrl }));
    const event = newNotifySNSEvent(mockSnsData);
    const result = await subject(event);
    expect(index.deps.SNS.publish).to.have.been.called();
  });


  it('adds action=reject to query string in one of the API links', async () => {
    const mockSnsData = {
      token: randString(),
      stageName: randString(),
      actionName: randString(),
    };
    const mockApiUrl = `https://${randString()}?`;
    chai.spy.on(index.deps.SNS, 'publish', (params) => {
      const message = params.Message;
      const paramRe = new RegExp(`${mockApiUrl}.*action=reject.*`, 'g');
      expect(message.match(paramRe), 'action=reject not found in query string').to.be.a('Array');
      expect(message.match(paramRe).length, 'action=reject found in more than one link').to.eq(1);
      return { promise: _ => Promise.resolve() };
    });
    chai.spy.on(index.deps, 'loadConfig', _ => ({ approvalApiUrl: mockApiUrl }));
    const event = newNotifySNSEvent(mockSnsData);
    const result = await subject(event);
    expect(index.deps.SNS.publish).to.have.been.called();
  });

  it('logs the response on successfully posting to approvers SNS topic', async () => {
    chai.spy.on(index.deps.SNS, 'publish', _ => ({ promise: _ => Promise.resolve('mock fetch response') }));
    chai.spy.on(index.deps, 'loadConfig', _ => ({}));
    const event = newNotifySNSEvent();
    const result = await subject(event);
    expect(index.deps.log).to.have.been.called.with('mock fetch response');
  });

  it('logs an error if it fails to post to approvers SNS topic', async () => {
    const mockError = new Error('fetch error');
    chai.spy.on(index.deps.SNS, 'publish', _ => ({ promise: _ => Promise.reject(mockError) }));
    chai.spy.on(index.deps, 'loadConfig', _ => ({}));
    const event = newNotifySNSEvent();
    const result = await subject(event);
    expect(index.deps.error).to.have.been.called.with(mockError);
  });
});
