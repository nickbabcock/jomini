var jomini = require('.');
var concat = require('concat-stream');

var concatStream = concat(function(buf) {
  var str = buf.toString('utf8');
  var obj = jomini.parse(str);
  process.stdout.write(JSON.stringify(obj));
});

process.stdin.pipe(concatStream);
