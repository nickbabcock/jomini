var para = require('../');
var stream = require('stream');
var streambuffers = require('stream-buffers');
var expect = require('chai').expect

function conversion(text, cb) {
    var s = new stream.Readable();
    s.push(text);
    s.push(null);
    var buf = new streambuffers.WritableStreamBuffer()
    var p = para();
    var res = s.pipe(p).pipe(buf);
    //var res = s.pipe(para());
    p.on('finish', function() {
        buf.end();
        cb(buf.getContentsAsString("utf8"));
    });
}

function parse(input, expected, cb) {
    conversion(input, function(actual) {
        console.log(actual);
        expect(JSON.parse(actual), actual).to.equal(JSON.parse(expected));
        cb()
    });
}

describe('toJson', function() {
    it('should handle the empty case', function(done) {
        parse('foo=bar', '{"foo":"bar":}', done);
    });
});
