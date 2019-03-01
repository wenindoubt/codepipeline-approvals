
// Helper for generating unique expected values for each test
exports.randString = () => Math.random().toString(36).substring(2, 15);

// Setup common used chai extensions
const chai = require('chai');
chai.use(require('chai-spies'));
chai.use(require('chai-like'));
chai.use(require('chai-things'));
chai.use(require('chai-spies'));
chai.use(require('chai-like'));
chai.use(require('chai-things'));
exports.chai = chai;
