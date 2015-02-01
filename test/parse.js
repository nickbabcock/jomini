var parse = require('../').parse;
var expect = require('chai').expect;
var blue = require('bluebird');

describe('parse', function() {
  it('should handle the simple parse case', function(done) {
    parse('foo=bar', function(err, actual) {
      expect(actual).to.deep.equal({'foo': 'bar'});
      done();
    });
  });

  it('should be able to be promisified', function(done) {
    var parseAsync = blue.promisify(parse);
    parseAsync('foo=bar').then(function(data) {
      expect(data).to.deep.equal({'foo': 'bar'});
      done();
    });
  });
});
