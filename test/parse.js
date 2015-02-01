var parse = require('../').parse;
var expect = require('chai').expect;

describe('parse', function() {
  it('should handle the simple parse case', function(done) {
    parse('foo=bar', function(err, actual) {
      expect(actual).to.deep.equal({'foo': 'bar'});
      done();
    });
  });
});