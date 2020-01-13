var toBool = require('../').toBool;
var expect = require('chai').expect;

describe('toBool', function() {
  it('should parse yes as true', function() {
    expect(toBool('yes')).to.equal(true);
  });

  it('should parse no as false', function() {
    expect(toBool('no')).to.equal(false);
  });

  it('should parse others as undefined', function() {
    expect(toBool('blah')).to.equal(undefined);
  });
});
