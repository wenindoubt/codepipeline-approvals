'use strict';

const index = require('../../index.js');
const chai = require('chai');
const expect = chai.expect;
var event, context;

// Function to make it easier to create test event objects
// to send to the test handler.
const new_test_event = () => ({
})

describe.skip('Tests index', function () {
    it('verifies successful response', async () => {
        const event = new_test_event()
        const result = await index.handler(event, context)
        let response = JSON.parse(result.body);
    });
});
