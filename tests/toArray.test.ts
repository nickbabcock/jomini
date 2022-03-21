import { expect, it } from "vitest";
import { toArray } from "..";

it("should handle the easy case", () => {
  var obj = {
    foo: {},
    bar: 1,
  };
  toArray(obj, "foo");
  expect(obj).toEqual({
    foo: [{}],
    bar: 1,
  });
});

it("should ignore nonexistant properties", () => {
  var obj = {};
  toArray(obj, "foo");
  expect(obj).toEqual({});
});

it("should ignore nonexistant nested properties", () => {
  var obj = {};
  toArray(obj, "foo.bar");
  expect(obj).toEqual({});
});

it("should change nested paths", () => {
  var obj = {
    foo: {
      baz: 1,
    },
  };

  toArray(obj, "foo.baz");
  expect(obj).toEqual({
    foo: {
      baz: [1],
    },
  });
});

it("should make no change for an array already", () => {
  var obj = {
    foo: [1],
  };

  toArray(obj, "foo");
  expect(obj).toEqual({
    foo: [1],
  });
});

it("should make changes for a nested array", () => {
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
  expect(obj).toEqual({
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

it("should do nothing if the nested property is useless", () => {
  var obj = {
    foo: [1, 2],
  };

  toArray(obj, "foo.baz");
  expect(obj).toEqual({
    foo: [1, 2],
  });
});

it("should do nothing if the nested properties is not an object", () => {
  var obj = {
    foo: 1,
  };

  toArray(obj, "foo.baz");
  expect(obj).toEqual({
    foo: 1,
  });
});
