var Parser = require('../').Parser;
var stream = require('stream');
var expect = require('chai').expect;

function conversion(text, cb) {
  var s = new stream.Readable();
  s.push(text);
  s.push(null);
  var p = Parser();
  var res = s.pipe(p);
  p.on('finish', function() {
    cb(p.obj);
  });
}

function parse(input, expected, cb) {
  conversion(input, function(actual) {
    expect(actual).to.deep.equal(expected);
    cb();
  });
}

describe('toJson', function() {
  it('should handle the simple case', function(done) {
    parse('foo=bar', {'foo':'bar'}, done);
  });

  it('should handle whitespace', function(done) {
    parse('\tfoo = bar ', {'foo':'bar'}, done);
  });

  it('should handle the simple quoted case', function(done) {
    parse('foo="bar"', {'foo':'bar'}, done);
  });

  it('should handle string list accumulation', function(done) {
    parse('foo=bar\nfoo=qux', {'foo':['bar', 'qux']}, done);
  });

  it('should handle string list accumulation long', function(done) {
    parse('foo=bar\nfoo=qux\nfoo=baz', {'foo':['bar', 'qux', 'baz']}, done);
  });

  it('should handle quoted string list accumulation', function(done) {
    parse('foo="bar"\nfoo="qux"', {'foo':['bar', 'qux']}, done);
  });

  it('should handle whole numbers', function(done) {
    parse('foo=1', {'foo': 1}, done);
  });

  it('should handle zero', function(done) {
    parse('foo=0', {'foo': 0}, done);
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
    parse('foo=1\nfoo=-1.23', {'foo':[1, -1.23]}, done);
  });

  it('should handle dates', function(done) {
    parse('date=1821.1.1', {'date': new Date(Date.UTC(1821, 0, 1))}, done);
  });

  it('should deceptive dates', function(done) {
    parse('date=1821.a.1', {'date': '1821.a.1'}, done);
  });

  it('should handle quoted dates', function(done) {
    parse('date="1821.1.1"', {'date': new Date(Date.UTC(1821, 0, 1))}, done);
  });

  it('should handle accumulated dates', function(done) {
    parse('date="1821.1.1"\ndate=1821.2.1',
      {'date':[new Date(Date.UTC(1821, 0, 1)), new Date(Date.UTC(1821, 1, 1))]},
      done);
  });

  it('should handle consecutive strings', function(done) {
    parse('foo = { bar baz }', {'foo': ['bar', 'baz']}, done);
  });

  it('should handle consecutive strings no space', function(done) {
    parse('foo={bar baz}', {'foo': ['bar', 'baz']}, done);
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
      [new Date(Date.UTC(1821, 0, 1)), new Date(Date.UTC(1821, 1, 1))]}, done);
  });

  it('should make least common demoninator list', function(done) {
    parse('foo = { 1 a 1821.1.1 }', {'foo': ['1', 'a', '1821.1.1']}, done);
  });

  it('should understand comments mean skip line', function(done) {
    parse('# boo\r\n# baa\r\nfoo=a\r\n# bee', {'foo': 'a'}, done);
  });

  it('should understand simple objects', function(done) {
    parse('foo={bar=val}', {'foo': {'bar': 'val'}}, done);
  });

  it('should understand nested list objects', function(done) {
    parse('foo={bar={val}}', {'foo': {'bar': ['val']}}, done);
  });

  it('should understand objects with start spaces', function(done) {
    parse('foo= { bar=val}', {'foo': {'bar': 'val'}}, done);
  });

  it('should understand objects with end spaces', function(done) {
    parse('foo={bar=val }', {'foo': {'bar': 'val'}}, done);
  });

  it('should understand a list of objects', function(done) {
    var str = 'attachments={ { id=258579 type=4713 } ' +
      ' { id=258722 type=4713 } }';
    var obj = {
      attachments: [{
        id: 258579,
        type: 4713
      }, {
        id: 258722,
        type: 4713
      }]
    };

    parse(str, obj, done);
  });

  it('should understand a simple EU4 header', function(done) {
    var str = 'date=1640.7.1\r\nplayer="FRA"\r\nsavegame_version=' +
      '\r\n{\r\n\tfirst=1\r\n\tsecond=9\r\n\tthird=2\r\n\tforth=0\r\n}';
    var obj = {
      date: new Date(Date.UTC(1640, 6, 1)),
      player: 'FRA',
      savegame_version: {
        first: 1,
        second: 9,
        third: 2,
        forth: 0
      }
    };
    parse(str, obj, done);
  });

  it('should understand EU4 gameplay settings', function(done) {
    var str = 'gameplaysettings=\r\n{\r\n\tsetgameplayoptions=' +
      '\r\n\t{\r\n\t\t1 1 2 0 1 0 0 0 1 1 1 1 \r\n\t}\r\n}';
    var obj = {
      gameplaysettings: {
        setgameplayoptions: [1, 1, 2, 0, 1, 0, 0, 0, 1, 1, 1, 1]
      }
    };
    parse(str, obj, done);
  });

  it('should handle a constructor without new', function(done) {
    var p = Parser();
    p.write('foo=bar\n', 'utf8', function() {
      p.end();
    });

    p.on('finish', function() {
      expect(p.obj).to.deep.equal({'foo': 'bar'});
      done();
    });
  });

  it('should handle string list accumulation chunky norm', function(done) {
    var p = new Parser();
    p.write('foo=bar\n', 'utf8', function() {
      p.write('foo=qux', 'utf8', function() {
        p.end();
      });
    });

    p.on('finish', function() {
      expect(p.obj).to.deep.equal({'foo': ['bar', 'qux']});
      done();
    });
  });

  it('should handle string list accumulate chunky break', function(done) {
    var p = new Parser();
    p.write('foo=bar\nf', 'utf8', function() {
      p.write('oo=qux', 'utf8', function() {
        p.end();
      });
    });

    p.on('finish', function() {
      expect(p.obj).to.deep.equal({'foo': ['bar', 'qux']});
      done();
    });
  });

  it('should handle string list accumulate chunky space break', function(done) {
    var p = new Parser();
    p.write('foo = bar \n f', 'utf8', function() {
      p.write('oo = qux', 'utf8', function() {
        p.end();
      });
    });

    p.on('finish', function() {
      expect(p.obj).to.deep.equal({'foo': ['bar', 'qux']});
      done();
    });
  });

  it('should handle string list accumulate chunky equal', function(done) {
    var p = new Parser();
    p.write('foo=bar\nfoo=', 'utf8', function() {
      p.write('qux', 'utf8', function() {
        p.end();
      });
    });

    p.on('finish', function() {
      expect(p.obj).to.deep.equal({'foo': ['bar', 'qux']});
      done();
    });
  });

  it('should handle string list accumulate chunky value', function(done) {
    var p = new Parser();
    p.write('foo=bar\nfoo=qu', 'utf8', function() {
      p.write('x', 'utf8', function() {
        p.end();
      });
    });

    p.on('finish', function() {
      expect(p.obj).to.deep.equal({'foo': ['bar', 'qux']});
      done();
    });
  });

  it('should handle a chunky list', function(done) {
    var p = new Parser();
    p.write('foo= {1 1', 'utf8', function() {
      p.write('1 2}', 'utf8', function() {
        p.end();
      });
    });

    p.on('finish', function() {
      expect(p.obj).to.deep.equal({'foo': [1, 11, 2]});
      done();
    });
  });

  it('should handle back to backs', function(done) {
    var p = new Parser();
    var str1 = 'POR={type=0 max_demand=2.049 t_in=49.697 t_from=\r\n' +
      '{ C00=5.421 C18=44.276 } }';
    var str2 = 'SPA= { type=0 val=3.037 max_pow=1.447 max_demand=2.099 ' +
      'province_power=1.447 t_in=44.642 t_from= { C01=1.794 C17=42.848 } }';

    p.write(str1, 'utf8', function() {
      p.write(str2, 'utf8', function() {
        p.end();
      });
    });

    var expected = {
      POR: {
        type: 0,
        max_demand: 2.049,
        t_in: 49.697,
        t_from: {'C00': 5.421, 'C18': 44.276}
      },
      SPA: {
        type: 0,
        val: 3.037,
        max_pow: 1.447,
        max_demand: 2.099,
        province_power: 1.447,
        t_in: 44.642,
        t_from: {'C01': 1.794, 'C17': 42.848}
      }
    };

    p.on('finish', function() {
      expect(p.obj).to.deep.equal(expected);
      done();
    });
  });

  it('should understand a list of objects chunky', function(done) {
    var p = new Parser();
    var str1 = 'attachments={ { i';
    var str2 = 'd=258579 type=4713 }  { id=258722 type=4713 } }';

    p.write(str1, 'utf8', function() {
      p.write(str2, 'utf8', function() {
        p.end();
      });
    });

    var obj = {
      attachments: [{
        id: 258579,
        type: 4713
      }, {
        id: 258722,
        type: 4713
      }]
    };

    p.on('finish', function() {
      expect(p.obj).to.deep.equal(obj);
      done();
    });
  });
});
