var para = require('../');
var stream = require('stream');
var expect = require('chai').expect

function conversion(text, cb) {
    var s = new stream.Readable();
    s.push(text);
    s.push(null);
    var p = para();
    var res = s.pipe(p)
    p.on('finish', function() {
        cb(p.obj);
    });
}

function parse(input, expected, cb) {
    conversion(input, function(actual) {
        expect(actual).to.deep.equal(expected);
        cb()
    });
}

describe('toJson', function() {
    it('should handle the simple case', function(done) {
        parse('foo=bar', {"foo":"bar"}, done);
    });

    it('should handle whitespace', function(done) {
        parse('\tfoo = bar ', {"foo":"bar"}, done);
    });

    it('should handle the simple quoted case', function(done) {
        parse('foo="bar"', {"foo":"bar"}, done);
    });

    it('should handle string list accumulation', function(done) {
        parse('foo=bar\nfoo=qux', {"foo":["bar", "qux"]}, done);
    });

    it('should handle quoted string list accumulation', function(done) {
        parse('foo="bar"\nfoo="qux"', {"foo":["bar", "qux"]}, done);
    });

    it('should handle whole numbers', function(done) {
        parse('foo=1', {'foo': 1}, done);
    });

    it('should handle negative whole numbers', function(done) {
        parse('foo=-1', {'foo': -1}, done);
    });

    it('should handle decimal number', function(done) {
        parse('foo=1.23', {'foo': 1.23}, done);
    });

    it('should handle negative decimal number', function(done) {
        parse('foo=-1.23', {'foo': -1.23}, done);
    });
});
