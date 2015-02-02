var expect = require('chai').expect;
var toDate = require('../').toDate;

describe('toDate', function() {
  it('should parse regular dates', function() {
    var actual = toDate('1800.1.1');
    expect(actual).to.deep.equal(new Date(Date.UTC(1800, 0, 1)));
  });
});
