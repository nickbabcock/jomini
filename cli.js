var jomini = require('./');
var JS = require('json3');
var header = new jomini.Header({header: 'EU4txt'});
var parser = new jomini.Parser();
process.stdin.pipe(header).pipe(parser);
parser.on('finish', function() {
  process.stdout.write(JS.stringify(parser.obj), 'utf8', function() {});
});