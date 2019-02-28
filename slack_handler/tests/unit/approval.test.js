'use strict';
const index = require('../../index.js');
const subject = index.approvalHandler;
const helpers = require('../helpers.js');
const chai = helpers.chai,
      should = helpers.chai.should(),
      expect = helpers.chai.expect,
      randString = helpers.randString;

// Creates a test event that looks like the events we will receive from Slack when the user
// clicks one of the interactive buttons that were created by the notify lambda
const newApprovalEvent = (options = { approved: null, verificationToken: null, pipelineName: null, stageName: null, actionName: null, customData: null, approvalToken: null }) => {
  const { approved, verificationToken, pipelineName, stageName, actionName, customData, approvalToken } = options;
  const payload = {
    token: verificationToken,
    channel: {
      id: 'channel.id',
      name: 'channel.name'
    },
    user: {
      id: 'user.id',
      name: 'user.name'
    },
    actions: [
      {
        value: `{\"approve\": \"${approved}\", \"token\": \"${approvalToken}\", \"codePipelineName\": \"${pipelineName}\", \"stageName\":\"${stageName}\", \"actionName\": \"${actionName}\"}`
      },
    ]
  };
  return {
    // Only thing that matters on this one is the body, which contains the request payload from the Slack interactive message.
    // See https://api.slack.com/actions#request_payload
    body: `payload=${encodeURI(JSON.stringify(payload))}`,
    isBase64Encoded: false
  };
};

describe('approval handler', _ => {
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

  it('returns 403 when it fails to verify the Slack application that sent the request', async () => {
    const verificationToken = randString();
    const someOtherToken = randString();
    chai.spy.on(index.deps, 'loadConfig', _ => ({ pipelineName: '', verificationToken: someOtherToken, webhookUrl: '' }));
    const event = newApprovalEvent({verificationToken});
    const result = await subject(event);
    expect(result).to.include({ statusCode: 403 });
  });

  it('uses the approval token from the interactive message action', async () => {
    const verificationToken = randString();
    const approvalToken = randString();
    const wasCalledSpy = chai.spy();  // this is just to enforce that the interface function was actually called, otherwise
                                      // the internal expectation will silently pass
    chai.spy.on(index.deps, 'CodePipeline', (params) => chai.spy.interface({
        putApprovalResult: (putParams) => {
          expect(putParams.token).to.equal(approvalToken);
          wasCalledSpy(putParams);
          return { promise: _ => Promise.resolve() }
        }
      })
    );
    chai.spy.on(index.deps, 'loadConfig', _ => ({ verificationToken }));
    const event = newApprovalEvent({ approved: 'True', verificationToken, approvalToken });
    const result = await subject(event);
    expect(wasCalledSpy).to.be.called();
  });

  it('approves the pipeline when the submitted action has approve=True', async () => {
    const verificationToken = randString();
    const wasCalledSpy = chai.spy();  // this is just to enforce that the interface function was actually called, otherwise
                                      // the internal expectation will silently pass
    chai.spy.on(index.deps, 'CodePipeline', (params) => chai.spy.interface({
        putApprovalResult: (putParams) => {
          expect(putParams.result.status).to.equal('Approved');
          wasCalledSpy(putParams);
          return { promise: _ => Promise.resolve() }
        }
      })
    );
    chai.spy.on(index.deps, 'loadConfig', _ => ({ verificationToken }));
    const event = newApprovalEvent({ approved: 'True', verificationToken});
    const result = await subject(event);
    expect(wasCalledSpy).to.be.called();
  });

  it('rejects the pipeline when the submitted action has approve=False', async () => {
    const verificationToken = randString();
    const wasCalledSpy = chai.spy();  // this is just to enforce that the interface function was actually called, otherwise
                                      // the internal expectation will silently pass
    chai.spy.on(index.deps, 'CodePipeline', (params) => chai.spy.interface({
        putApprovalResult: (putParams) => {
          expect(putParams.result.status).to.equal('Rejected');
          wasCalledSpy(putParams);
          return { promise: _ => Promise.resolve() }
        }
      })
    );
    chai.spy.on(index.deps, 'loadConfig', _ => ({ verificationToken }));
    const event = newApprovalEvent({ approved: 'False', verificationToken});
    const result = await subject(event);
    expect(wasCalledSpy).to.be.called();
  });

  it('records who approved it and where it was approved in the approval summary', async () => {
    const verificationToken = randString();
    const wasCalledSpy = chai.spy();  // this is just to enforce that the interface function was actually called, otherwise
                                      // the internal expectation will silently pass
    chai.spy.on(index.deps, 'CodePipeline', (params) => chai.spy.interface({
        putApprovalResult: (putParams) => {
          expect(putParams.result.summary).to.include('user.name');
          expect(putParams.result.summary).to.include('channel.id');
          expect(putParams.result.summary).to.include('channel.name');
          wasCalledSpy(putParams);
          return { promise: _ => Promise.resolve() }
        }
      })
    );
    chai.spy.on(index.deps, 'loadConfig', _ => ({ verificationToken }));
    const event = newApprovalEvent({verificationToken});
    const result = await subject(event);
    expect(wasCalledSpy).to.be.called();
  });

  it('returns who approved back to the Slack application', async () => {
    const verificationToken = randString();
    const mockResponse = { statusCode: 200 };
    chai.spy.on(index.deps, 'CodePipeline', (params) => {
      return {
        putApprovalResult: (putParams) => ({
          promise: _ => Promise.resolve(mockResponse)
        })
      };
    });
    chai.spy.on(index.deps, 'loadConfig', _ => ({ verificationToken }));
    const event = newApprovalEvent({verificationToken});
    const result = await subject(event);
    expect(result.body).to.include('<@user.id>');
  });

  it('returns success even when the approval is already handled by another user so that the Slack client doesn\'t report it as an error to the user', async () => {
    const verificationToken = randString();
    const mockResponse = { statusCode: 400, code: 'ApprovalAlreadyCompletedException', message: 'Mock response' };
    chai.spy.on(index.deps, 'CodePipeline', (params) => {
      return {
        putApprovalResult: (putParams) => ({
          promise: _ => Promise.reject(mockResponse)
        })
      };
    });
    chai.spy.on(index.deps, 'loadConfig', _ => ({ verificationToken }));
    const event = newApprovalEvent({verificationToken});
    const result = await subject(event);
    expect(result).to.include({ statusCode: 200, body: 'Mock response' });
  });

  it('returns a 500 for all other failures of the Pipeline.putApprovalResult call so that the user knows something went wrong', async () => {
    const verificationToken = randString();
    const mockResponse = { statusCode: 400 };
    chai.spy.on(index.deps.CodePipeline, 'putApprovalResult', (params) => ({ promise: _ => Promise.reject(mockResponse) }));
    chai.spy.on(index.deps, 'loadConfig', _ => ({ verificationToken }));
    const event = newApprovalEvent({verificationToken});
    const result = await subject(event);
    expect(result).to.include({ statusCode: 500 });
  });
});
