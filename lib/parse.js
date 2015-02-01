var Parser = require('./parser');

function parse(text, cb) {
  var p = new Parser();
  p.end(text, 'utf8', function() {
    cb(null, p.obj);
  });
}

module.exports = parse;
