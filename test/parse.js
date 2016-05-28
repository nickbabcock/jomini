var parse = require('../lib/jomini').parse;
var expect = require('chai').expect;

describe('parse', function() {
  it('should handle the simple parse case', function() {
    expect(parse('foo=bar')).to.deep.equal({foo: 'bar'});
  });

  it('should handle the simple header case', function() {
    expect(parse('EU4txt\nfoo=bar')).to.deep.equal({foo: 'bar'});
  });

  it('should handle empty quoted strings', function() {
    expect(parse('foo=""')).to.deep.equal({foo: ''});
  });

  it('should handle whitespace', function() {
    expect(parse('\tfoo = bar ')).to.deep.equal({'foo':'bar'});
  });

  it('should handle the simple quoted case', function() {
    expect(parse('foo="bar"')).to.deep.equal({'foo':'bar'});
  });

  it('should handle string list accumulation', function() {
    expect(parse('foo=bar\nfoo=qux')).to.deep.equal({'foo':['bar', 'qux']});
  });

  it('should handle string list accumulation long', function() {
    expect(parse('foo=bar\nfoo=qux\nfoo=baz')).to.deep.
        equal({'foo':['bar', 'qux', 'baz']});
  });

  it('should handle quoted string list accumulation', function() {
    expect(parse('foo="bar"\nfoo="qux"')).to.deep.
        equal({'foo':['bar', 'qux']});
  });

  it('should handle boolen', function() {
    expect(parse('foo=yes')).to.deep.equal({'foo': true});
  });

  it('should handle boolen list', function() {
    expect(parse('foo={yes no}')).to.deep.equal({'foo': [true, false]});
  });

  it('should handle whole numbers', function() {
    expect(parse('foo=1')).to.deep.equal({'foo': 1});
  });

  it('should handle zero', function() {
    expect(parse('foo=0')).to.deep.equal({'foo': 0});
  });

  it('should handle negative whole numbers', function() {
    expect(parse('foo=-1')).to.deep.equal({'foo': -1});
  });

  it('should handle decimal number', function() {
    expect(parse('foo=1.23')).to.deep.equal({'foo': 1.23});
  });

  it('should handle negative decimal number', function() {
    expect(parse('foo=-1.23')).to.deep.equal({'foo': -1.23});
  });

  it('should handle number list accumulation', function() {
    expect(parse('foo=1\nfoo=-1.23')).to.deep.equal({'foo':[1, -1.23]});
  });

  it('should handle dates', function() {
    expect(parse('date=1821.1.1')).to.deep.
        equal({'date': new Date(Date.UTC(1821, 0, 1))});
  });

  /*it('should deceptive dates', function() {
    expect(parse('date=1821.a.1')).to.deep.equal({date': '1821.a.1'});
  });*/

  it('should handle quoted dates', function() {
    expect(parse('date="1821.1.1"')).to.deep.
        equal({'date': new Date(Date.UTC(1821, 0, 1))});
  });

  it('should handle accumulated dates', function() {
    expect(parse('date="1821.1.1"\ndate=1821.2.1')).to.deep.equal(
      {'date':[new Date(Date.UTC(1821, 0, 1)), new Date(Date.UTC(1821, 1, 1))]}
    );
  });

  it('should handle numbers as identifiers', function() {
    expect(parse('158=10')).to.deep.equal({'158': 10});
  });

  it('should handle periods in identifiers', function() {
    expect(parse('flavor_tur.8=yes')).to.deep.equal({'flavor_tur.8': true});
  });

  it('should handle empty objects for dates', function() {
    expect(parse('1920.1.1={}')).to.deep.equal({'1920.1.1': {}});
  });

  it('should handle consecutive strings', function() {
    expect(parse('foo = { bar baz }')).to.deep.equal({'foo': ['bar', 'baz']});
  });

  it('should handle consecutive strings no space', function() {
    expect(parse('foo={bar baz}')).to.deep.equal({'foo': ['bar', 'baz']});
  });

  it('should handle consecutive quoted strings', function() {
    expect(parse('foo = { "bar" "baz" }')).to.deep.
        equal({'foo': ['bar', 'baz']});
  });

  it('should handle empty object', function() {
    expect(parse('foo = {}')).to.deep.equal({'foo': {}});
  });

  it('should handle space empty object', function() {
    expect(parse('foo = { }')).to.deep.equal({'foo': {}});
  });

  it('should handle the object after empty object', function() {
    var obj = {
      foo: {},
      catholic: {
        defender: 'me'
      }
    };

    expect(parse('foo={} catholic={defender="me"}')).to.deep.equal(obj);
  });

  it('should handle the object after empty object nested', function() {
    var obj = {
      religion: {
        foo: {},
        catholic: {
          defender: 'me'
        }
      }
    };

    expect(parse('religion={foo={} catholic={defender="me"}}')).to.deep.
        equal(obj);
  });

  it('should ignore empty objects with no identifier at end', function() {
    expect(parse('foo={bar=val {}}  { } me=you')).to.deep.
        equal({foo: {bar: 'val'}, me: 'you'});
  });

  it('should understand a list of objects', function() {
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

    expect(parse(str)).to.deep.equal(obj);
  });

  it('should parse minimal spacing for objects', function() {
    var str = 'nation={ship={name="ship1"} ship={name="ship2"}}';
    var obj = {
      nation: {
        ship: [{name: 'ship1'}, {name: 'ship2'}]
      }
    };

    expect(parse(str)).to.deep.equal(obj);
  });

  it('should understand a simple EU4 header', function() {
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
    expect(parse(str)).to.deep.equal(obj);
  });

  it('should understand EU4 gameplay settings', function() {
    var str = 'gameplaysettings=\r\n{\r\n\tsetgameplayoptions=' +
      '\r\n\t{\r\n\t\t1 1 2 0 1 0 0 0 1 1 1 1 \r\n\t}\r\n}';
    var obj = {
      gameplaysettings: {
        setgameplayoptions: [1, 1, 2, 0, 1, 0, 0, 0, 1, 1, 1, 1]
      }
    };
    expect(parse(str)).to.deep.equal(obj);
  });

  it('should parse multiple objects accumulated', function() {
    var str = 'army=\r\n{\r\n\tname="1st army"\r\n\tunit={\r\n\t\t' +
      'name="1st unit"\r\n\t}\r\n}\r\narmy=\r\n{\r\n\tname="2nd army"' +
      '\r\n\tunit={\r\n\t\tname="1st unit"\r\n\t}\r\n\tunit={\r\n\t\t' +
      'name="2nd unit"\r\n\t}\r\n}';

    var obj = {
      army: [{
        name: '1st army',
        unit: {
          name: '1st unit'
        }
      }, {
        name: '2nd army',
        unit: [{
          name: '1st unit'
        }, {
          name: '2nd unit'
        }]
      }]
    };

    expect(parse(str)).to.deep.equal(obj);
  });

  it('should handle back to backs', function() {
    var str1 = 'POR={type=0 max_demand=2.049 t_in=49.697 t_from=\r\n' +
      '{ C00=5.421 C18=44.276 } }';
    var str2 = 'SPA= { type=0 val=3.037 max_pow=1.447 max_demand=2.099 ' +
      'province_power=1.447 t_in=44.642 t_from= { C01=1.794 C17=42.848 } }';

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

    expect(parse(str1 + str2)).to.deep.equal(expected);
  });

  it('should handle dates as identifiers', function() {
    expect(parse('1480.1.1=yes')).to.deep.equal({'1480.1.1': true});
  });

  it('should handle consecutive numbers', function() {
    expect(parse('foo = { 1 -1.23 }')).to.deep.equal({'foo': [1, -1.23]});
  });

  it('should handle consecutive dates', function() {
    expect(parse('foo = { 1821.1.1 1821.2.1 }')).to.deep.equal({'foo':
      [new Date(Date.UTC(1821, 0, 1)), new Date(Date.UTC(1821, 1, 1))]});
  });

  it('should understand comments mean skip line', function() {
    expect(parse('# boo\r\n# baa\r\nfoo=a\r\n# bee')).to.deep.
        equal({'foo': 'a'});
  });

  it('should understand simple objects', function() {
    expect(parse('foo={bar=val}')).to.deep.equal({'foo': {'bar': 'val'}});
  });

  it('should understand nested list objects', function() {
    expect(parse('foo={bar={val}}')).to.deep.equal({'foo': {'bar': ['val']}});
  });

  it('should understand objects with start spaces', function() {
    expect(parse('foo= { bar=val}')).to.deep.equal({'foo': {'bar': 'val'}});
  });

  it('should understand objects with end spaces', function() {
    expect(parse('foo={bar=val }')).to.deep.equal({'foo': {'bar': 'val'}});
  });

  it('should ignore empty objects with no identifier', function() {
    expect(parse('foo={bar=val} {} { } me=you')).to.deep.
        equal({foo: {bar: 'val'}, me: 'you'});
  });

  it('should handle strings as identifiers', function() {
    expect(parse('"foo"="bar"')).to.deep.equal({'foo': 'bar'});
  });

  it('should handle = as identifier', function() {
    expect(parse('=="bar"')).to.deep.equal({'=': 'bar'});
  });

  it('should handle values with colon sign', function() {
    expect(parse('foo=bar:foo')).to.deep.equal({'foo': 'bar:foo'});
  });

  it('should handle variables', function() {
      expect(parse('@planet_standard_scale = 11')).to.deep.equal({'@planet_standard_scale': 11});
  });
});
