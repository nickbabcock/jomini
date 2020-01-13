var toArray = require('../').toArray;
var expect = require('chai').expect;

describe('toArray', function() {
  it('should handle the easy case', function() {
    var obj = {
      foo: {},
      bar: 1
    };

    toArray(obj, 'foo');
    expect(obj).to.deep.equal({
      foo: [{}],
      bar: 1
    });
  });

  it('should ignore nonexistant properties', function() {
    var obj = {};
    toArray(obj, 'foo');
    expect(obj).to.deep.equal({});
  });

  it('should ignore nonexistant nested properties', function() {
    var obj = {};
    toArray(obj, 'foo.bar');
    expect(obj).to.deep.equal({});
  });

  it('should change nested paths', function() {
    var obj = {
      foo: {
        baz: 1
      }
    };

    toArray(obj, 'foo.baz');
    expect(obj).to.deep.equal({
      foo: {
        baz: [1]
      }
    });
  });

  it('should make no change for an array already', function() {
    var obj = {
      foo: [1]
    };

    toArray(obj, 'foo');
    expect(obj).to.deep.equal({
      foo: [1]
    });
  });

  it('should make changes for a nested array', function() {
    var obj = {
      foo: [{
        baz: [1, 2]
      }, {
        baz: 1
      }]
    };

    toArray(obj, 'foo.baz');
    expect(obj).to.deep.equal({
      foo: [{
        baz: [1, 2]
      }, {
        baz: [1]
      }]
    });
  });

  it('should do nothing if the nested property is useless', function() {
    var obj = {
      foo: [1, 2]
    };

    toArray(obj, 'foo.baz');
    expect(obj).to.deep.equal({
      foo: [1, 2]
    });
  });

  it('should do nothing if the nested properties is not an object', function() {
    var obj = {
      foo: 1
    };

    toArray(obj, 'foo.baz');
    expect(obj).to.deep.equal({
      foo: 1
    });
  });
});
