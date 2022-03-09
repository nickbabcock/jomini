const test = require("ava");
const { toArray } = require("jomini");

test("should handle the easy case", (t) => {
  var obj = {
    foo: {},
    bar: 1,
  };
  toArray(obj, "foo");
  t.deepEqual(obj, {
    foo: [{}],
    bar: 1,
  });
});

test("should ignore nonexistant properties", (t) => {
  var obj = {};
  toArray(obj, "foo");
  t.deepEqual(obj, {});
});

test("should ignore nonexistant nested properties", (t) => {
  var obj = {};
  toArray(obj, "foo.bar");
  t.deepEqual(obj, {});
});

test("should change nested paths", (t) => {
  var obj = {
    foo: {
      baz: 1,
    },
  };

  toArray(obj, "foo.baz");
  t.deepEqual(obj, {
    foo: {
      baz: [1],
    },
  });
});

test("should make no change for an array already", (t) => {
  var obj = {
    foo: [1],
  };

  toArray(obj, "foo");
  t.deepEqual(obj, {
    foo: [1],
  });
});

test("should make changes for a nested array", (t) => {
  var obj = {
    foo: [
      {
        baz: [1, 2],
      },
      {
        baz: 1,
      },
    ],
  };

  toArray(obj, "foo.baz");
  t.deepEqual(obj, {
    foo: [
      {
        baz: [1, 2],
      },
      {
        baz: [1],
      },
    ],
  });
});

test("should do nothing if the nested property is useless", (t) => {
  var obj = {
    foo: [1, 2],
  };

  toArray(obj, "foo.baz");
  t.deepEqual(obj, {
    foo: [1, 2],
  });
});

test("should do nothing if the nested properties is not an object", (t) => {
  var obj = {
    foo: 1,
  };

  toArray(obj, "foo.baz");
  t.deepEqual(obj, {
    foo: 1,
  });
});
