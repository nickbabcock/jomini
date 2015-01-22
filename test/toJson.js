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

    it('should handle number list accumulation', function(done) {
        parse('foo=1\nfoo=-1.23', {"foo":[1, -1.23]}, done);
    });

    it('should handle dates', function(done) {
        parse('date=1821.1.1', {"date": "1821-01-01T00:00:00.000Z"}, done);
    });

    it('should handle quoted dates', function(done) {
        parse('date="1821.1.1"', {"date": "1821-01-01T00:00:00.000Z"}, done);
    });

    it('should handle accumulated dates', function(done) {
        parse('date="1821.1.1"\ndate=1821.2.1',
            {"date":["1821-01-01T00:00:00.000Z", "1821-02-01T00:00:00.000Z"]},
            done);
    });

    it('should handle consecutive strings', function(done) {
        parse('foo = { bar baz }', {'foo': ['bar', 'baz']}, done);
    });

    it('should handle consecutive quoted strings', function(done) {
        parse('foo = { "bar" "baz" }', {'foo': ['bar', 'baz']}, done);
    });

    it('should handle empty list', function(done) {
        parse('foo = {}', {'foo': []}, done);
    });

    it('should handle space empty list', function(done) {
        parse('foo = { }', {'foo': []}, done);
    });

    it('should handle consecutive numbers', function(done) {
        parse('foo = { 1 -1.23 }', {'foo': [1, -1.23]}, done);
    });

    it('should handle consecutive dates', function(done) {
        parse('foo = { 1821.1.1 1821.2.1 }', {'foo':
            ["1821-01-01T00:00:00.000Z", "1821-02-01T00:00:00.000Z"]}, done);
    });

    it('should make least common demoninator list', function(done) {
        parse('foo = { 1 a 1821.1.1 }', {'foo': ['1', 'a', '1821.1.1']}, done);
    });

    it('should understand comments mean skip line', function(done) {
        parse('# boo\r\n# baa\r\nfoo=a\r\n# bee', {'foo': 'a'}, done);
    });

  /*  it('should understand simple objects', function(done) {
        parse('foo={bar=val}', {'foo': { 'bar': 'val' }}, done);
    });*/
});
