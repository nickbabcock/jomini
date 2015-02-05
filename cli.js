var jomini = require('./');
var JS = require('json3');
var concat = require('concat-stream');
var concatStream = concat(function(buf) {
    var str = buf.toString('utf8');
    var obj = jomini.parse(str);
    process.stdout.write(JS.stringify(obj));
});

process.stdin.pipe(concatStream)
