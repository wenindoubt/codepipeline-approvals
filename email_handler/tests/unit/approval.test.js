'use strict';
const index = require('../../index.js');
const subject = index.approvalHandler;
const helpers = require('../helpers.js');
const chai = helpers.chai,
      should = helpers.chai.should(),
      expect = helpers.chai.expect,
      randString = helpers.randString;

// Creates a test event that looks like the events we will receive from the API when the user
// clicks one of the links that were created by the notify lambda
const newApprovalEvent = (options = { action: null, apiUrl: null, stageName: null, actionName: null, token: null }) => {
  const { action, apiUrl, stageName, actionName, customData, token } = options;
  const event = {
    requestContext: { domainName: apiUrl },
    queryStringParameters: {
      action,
      actionName,
      stageName,
      token,
    }
  };
  return event;
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

  // We should do something like this just to make sure the notify lambda sent the link, as an extra precaution
  it.skip('returns 403 when it fails to verify the application that sent the request', async () => {
    const verificationToken = randString();
    const someOtherToken = randString();
    chai.spy.on(index.deps, 'loadConfig', _ => ({ pipelineName: '', verificationToken: someOtherToken, webhookUrl: '' }));
    const event = newApprovalEvent({verificationToken});
    const result = await subject(event);
    expect(result).to.include({ statusCode: 403 });
  });

  it('uses the approval token from the query string', async () => {
    const token = randString();
    const wasCalledSpy = chai.spy();  // this is just to enforce that the interface function was actually called, otherwise
                                      // the internal expectation will silently pass
    chai.spy.on(index.deps, 'CodePipeline', (params) => chai.spy.interface({
        putApprovalResult: (putParams) => {
          expect(putParams.token).to.equal(token);
          wasCalledSpy(putParams);
          return { promise: _ => Promise.resolve() }
        }
      })
    );
    chai.spy.on(index.deps, 'loadConfig', _ => ({}));
    const event = newApprovalEvent({ token });
    const result = await subject(event);
    expect(wasCalledSpy).to.be.called();
  });

  it('approves the pipeline when the submitted action has action=approve', async () => {
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
    chai.spy.on(index.deps, 'loadConfig', _ => ({}));
    const event = newApprovalEvent({ action: 'approve'});
    const result = await subject(event);
    expect(wasCalledSpy).to.be.called();
  });

  it('rejects the pipeline when the submitted action has action=reject', async () => {
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
    chai.spy.on(index.deps, 'loadConfig', _ => ({}));
    const event = newApprovalEvent({ action: 'reject'});
    const result = await subject(event);
    expect(wasCalledSpy).to.be.called();
  });

  it('records who approved it and where it was approved in the approval summary', async () => {
    const apiUrl = randString();
    const approvers = randString();
    const wasCalledSpy = chai.spy();  // this is just to enforce that the interface function was actually called, otherwise
                                      // the internal expectation will silently pass
    chai.spy.on(index.deps, 'CodePipeline', (params) => chai.spy.interface({
        putApprovalResult: (putParams) => {
          expect(putParams.result.summary).to.include(apiUrl);
          expect(putParams.result.summary).to.include(approvers);
          wasCalledSpy(putParams);
          return { promise: _ => Promise.resolve() }
        }
      })
    );
    chai.spy.on(index.deps, 'loadConfig', _ => ({ approvers }));
    const event = newApprovalEvent({ apiUrl });
    const result = await subject(event);
    expect(wasCalledSpy).to.be.called();
  });

  it('gives feedback to the user when their approval action was successful', async () => {
    const mockResponse = { statusCode: 200 };
    chai.spy.on(index.deps, 'CodePipeline', (params) => {
      return {
        putApprovalResult: (putParams) => ({
          promise: _ => Promise.resolve(mockResponse)
        })
      };
    });
    chai.spy.on(index.deps, 'loadConfig', _ => ({}));
    const event = newApprovalEvent({ action: 'approve' });
    const result = await subject(event);
    expect(result.body).to.include('Approved');
  });

  it('gives feedback to the user when their reject action was successful', async () => {
    const mockResponse = { statusCode: 200 };
    chai.spy.on(index.deps, 'CodePipeline', (params) => {
      return {
        putApprovalResult: (putParams) => ({
          promise: _ => Promise.resolve(mockResponse)
        })
      };
    });
    chai.spy.on(index.deps, 'loadConfig', _ => ({}));
    const event = newApprovalEvent({ action: 'reject' });
    const result = await subject(event);
    expect(result.body).to.include('Rejected');
  });

  it('returns an error message from the Pipeline when the approval was already handled by another user', async () => {
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
    expect(result).to.include({ statusCode: 500, body: 'Mock response' });
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
