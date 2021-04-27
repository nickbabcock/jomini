const test = require("ava");
const { Jomini, toArray } = require("..");

const encoder = new TextEncoder();
const utf8encode = (s) => encoder.encode(s);
const parse = async (s, q) => {
  const jomini = await Jomini.initialize();
  const data = utf8encode(s);
  return jomini.parseText(data, { encoding: "utf8" }, q);
};

test("can instantiate parser", async (t) => {
  const _1 = await Jomini.initialize();

  // Make sure we can call it again
  const _2 = await Jomini.initialize();
  t.pass();
});

test("should handle the simple parse case", async (t) => {
  t.deepEqual(await parse("foo=bar"), { foo: "bar" });
});

test("should handle the simple header case", async (t) => {
  t.deepEqual(await parse("EU4txt\nfoo=bar"), { foo: "bar" });
});

test("should handle empty quoted strings", async (t) => {
  t.deepEqual(await parse('foo=""'), { foo: "" });
});

test("should handle whitespace", async (t) => {
  t.deepEqual(await parse("\tfoo = bar "), { foo: "bar" });
});

test("should handle the simple quoted case", async (t) => {
  t.deepEqual(await parse('foo="bar"'), { foo: "bar" });
});

test("should handle string list accumulation long", async (t) => {
  t.deepEqual(await parse("foo=bar\nfoo=qux\nfoo=baz"), {
    foo: ["bar", "qux", "baz"],
  });
});

test("should handle quoted string list accumulation", async (t) => {
  t.deepEqual(await parse('foo="bar"\nfoo="qux"'), { foo: ["bar", "qux"] });
});

test("should handle boolean", async (t) => {
  t.deepEqual(await parse("foo=yes"), { foo: true });
});

test("should handle boolen list", async (t) => {
  t.deepEqual(await parse("foo={yes no}"), { foo: [true, false] });
});

test("should handle whole numbers", async (t) => {
  t.deepEqual(await parse("foo=1"), { foo: 1 });
});

test("should handle zero", async (t) => {
  t.deepEqual(await parse("foo=0"), { foo: 0 });
});

test("should handle negative whole numbers", async (t) => {
  t.deepEqual(await parse("foo=-1"), { foo: -1 });
});

test("should handle decimal number", async (t) => {
  t.deepEqual(await parse("foo=1.23"), { foo: 1.23 });
});

test("should handle negative decimal number", async (t) => {
  t.deepEqual(await parse("foo=-1.23"), { foo: -1.23 });
});

test("should handle negative decimal number regression", async (t) => {
  t.deepEqual(await parse("foo=-0.5"), { foo: -0.5 });
});

test("should handle number list accumulation", async (t) => {
  t.deepEqual(await parse("foo=1\nfoo=-1.23"), { foo: [1, -1.23] });
});

test("should handle dates", async (t) => {
  t.deepEqual(await parse("date=1821.1.1"), {
    date: new Date(Date.UTC(1821, 0, 1)),
  });
});

test("should deceptive dates", async (t) => {
  t.deepEqual(await parse("date=1821.a.1"), { date: "1821.a.1" });
});

test("should handle quoted dates", async (t) => {
  t.deepEqual(await parse('date="1821.1.1"'), {
    date: new Date(Date.UTC(1821, 0, 1)),
  });
});

test("should handle accumulated dates", async (t) => {
  t.deepEqual(await parse('date="1821.1.1"\ndate=1821.2.1'), {
    date: [new Date(Date.UTC(1821, 0, 1)), new Date(Date.UTC(1821, 1, 1))],
  });
});

test("should parse negative dates", async (t) => {
  t.deepEqual(await parse("date=-17.1.1"), {
    date: new Date(Date.UTC(-17, 0, 1)),
  });
});

test("should parse large negative dates", async (t) => {
  t.deepEqual(await parse("date=-2500.1.1"), {
    date: new Date(Date.UTC(-2500, 0, 1)),
  });
});

test("should handle numbers as identifiers", async (t) => {
  t.deepEqual(await parse("158=10"), { 158: 10 });
});

test("should handle periods in identifiers", async (t) => {
  t.deepEqual(await parse("flavor_tur.8=yes"), { "flavor_tur.8": true });
});

test("should handle consecutive strings", async (t) => {
  t.deepEqual(await parse("foo = { bar baz }"), { foo: ["bar", "baz"] });
});

test("should handle consecutive strings no space", async (t) => {
  t.deepEqual(await parse("foo={bar baz}"), { foo: ["bar", "baz"] });
});

test("should handle consecutive quoted strings", async (t) => {
  t.deepEqual(await parse('foo = { "bar" "baz" }'), { foo: ["bar", "baz"] });
});

test("should handle empty object", async (t) => {
  t.deepEqual(await parse("foo = {}"), { foo: {} });
});

test("should handle parameter definition value", async (t) => {
  t.deepEqual(await parse("foo = { [[add] $add$]}"), { foo: { "[add]": "$add$" } });
});

test("should handle parameter definitions", async (t) => {
  t.deepEqual(await parse("foo = { [[add] if={a=b}]}"), { foo: { "[add]": {if: {a: "b"}}} });
});

test("should handle undefined parameter definitions", async (t) => {
  t.deepEqual(await parse("foo = { [[!add] if={a=b}]}"), { foo: { "[!add]": {if: {a: "b"}}} });
});

test("should parse through extra trailing brace", async (t) => {
  t.deepEqual(await parse("foo = { bar } }"), { foo: ["bar"] });
});

test("should parse through any extra braces", async (t) => {
  t.deepEqual(await parse("a = { 10 } } b = yes"), { a: [10], b: true });
});

test("should handle space empty object", async (t) => {
  t.deepEqual(await parse("foo = { }"), { foo: {} });
});

test("should handle empty objects for dates", async (t) => {
  t.deepEqual(await parse("1920.1.1={}"), { "1920.1.1": {} });
});

test("should handle the object after empty object", async (t) => {
  const obj = {
    foo: {},
    catholic: {
      defender: "me",
    },
  };
  t.deepEqual(await parse('foo={} catholic={defender="me"}'), obj);
});

test("should handle the object after empty object nested", async (t) => {
  const obj = {
    religion: {
      foo: {},
      catholic: {
        defender: "me",
      },
    },
  };

  t.deepEqual(await parse('religion={foo={} catholic={defender="me"}}'), obj);
});

test("should ignore empty objects with no identifier at end", async (t) => {
  t.deepEqual(await parse("foo={bar=val {}}  { } me=you"), {
    foo: { bar: { val: {} } },
    me: "you",
  });
});

test("should understand a list of objects", async (t) => {
  const str = "attachments={ { id=258579 type=4713 } { id=258722 type=4713 } }";
  const obj = {
    attachments: [
      {
        id: 258579,
        type: 4713,
      },
      {
        id: 258722,
        type: 4713,
      },
    ],
  };
  t.deepEqual(await parse(str), obj);
});

test("should parse minimal spacing for objects", async (t) => {
  const str = 'nation={ship={name="ship1"} ship={name="ship2"}}';
  const obj = {
    nation: {
      ship: [{ name: "ship1" }, { name: "ship2" }],
    },
  };
  t.deepEqual(await parse(str), obj);
});

test("should understand a simple EU4 header", async (t) => {
  const str =
    'date=1640.7.1\r\nplayer="FRA"\r\nsavegame_version=' +
    "\r\n{\r\n\tfirst=1\r\n\tsecond=9\r\n\tthird=2\r\n\tforth=0\r\n}";
  const obj = {
    date: new Date(Date.UTC(1640, 6, 1)),
    player: "FRA",
    savegame_version: {
      first: 1,
      second: 9,
      third: 2,
      forth: 0,
    },
  };
  t.deepEqual(await parse(str), obj);
});

test("should understand EU4 gameplay settings", async (t) => {
  const str =
    "gameplaysettings=\r\n{\r\n\tsetgameplayoptions=" +
    "\r\n\t{\r\n\t\t1 1 2 0 1 0 0 0 1 1 1 1 \r\n\t}\r\n}";
  const obj = {
    gameplaysettings: {
      setgameplayoptions: [1, 1, 2, 0, 1, 0, 0, 0, 1, 1, 1, 1],
    },
  };
  t.deepEqual(await parse(str), obj);
});

test("should parse multiple objects accumulated", async (t) => {
  const str = `
  army={
    name="1st army"
    unit={ name="1st unit" }
  }
  army={
    name="2nd army"
    unit={ name="2nd unit" }
    unit={ name="3rd unit" }
  }
  `;
  const obj = {
    army: [
      {
        name: "1st army",
        unit: {
          name: "1st unit",
        },
      },
      {
        name: "2nd army",
        unit: [
          {
            name: "2nd unit",
          },
          {
            name: "3rd unit",
          },
        ],
      },
    ],
  };
  t.deepEqual(await parse(str), obj);

  toArray(obj, "army.unit");
  const expected = {
    army: [
      {
        name: "1st army",
        unit: [
          {
            name: "1st unit",
          },
        ],
      },
      {
        name: "2nd army",
        unit: [
          {
            name: "2nd unit",
          },
          {
            name: "3rd unit",
          },
        ],
      },
    ],
  };
  t.deepEqual(obj, expected);
});

test("should handle back to backs", async (t) => {
  const str1 =
    "POR={type=0 max_demand=2.049 t_in=49.697 t_from=\r\n" +
    "{ C00=5.421 C18=44.276 } }";
  const str2 =
    "SPA= { type=0 val=3.037 max_pow=1.447 max_demand=2.099 " +
    "province_power=1.447 t_in=44.642 t_from= { C01=1.794 C17=42.848 } }";
  const obj = {
    POR: {
      type: 0,
      max_demand: 2.049,
      t_in: 49.697,
      t_from: { C00: 5.421, C18: 44.276 },
    },
    SPA: {
      type: 0,
      val: 3.037,
      max_pow: 1.447,
      max_demand: 2.099,
      province_power: 1.447,
      t_in: 44.642,
      t_from: { C01: 1.794, C17: 42.848 },
    },
  };
  t.deepEqual(await parse(str1 + str2), obj);
});

test("should understand object trailers", async (t) => {
  t.deepEqual(await parse("area = { color = { 10 } 1 2 }"), {
    area: { color: [10], trailer: [1, 2] },
  });
});

test("should understand comments mean skip line", async (t) => {
  t.deepEqual(await parse("# boo\r\n# baa\r\nfoo=a\r\n# bee"), { foo: "a" });
});

test("should understand simple objects", async (t) => {
  t.deepEqual(await parse("foo={bar=val}"), { foo: { bar: "val" } });
});

test("should understand nested list objects", async (t) => {
  t.deepEqual(await parse("foo={bar={val}}"), { foo: { bar: ["val"] } });
});

test("should understand objects with start spaces", async (t) => {
  t.deepEqual(await parse("foo= { bar=val}"), { foo: { bar: "val" } });
});

test("should understand objects with end spaces", async (t) => {
  t.deepEqual(await parse("foo={bar=val }"), { foo: { bar: "val" } });
});

test("should ignore empty objects with no identifier", async (t) => {
  t.deepEqual(await parse("foo={bar=val} {} { } me=you"), {
    foo: { bar: "val" },
    me: "you",
  });
});

test("should handle strings as identifiers", async (t) => {
  t.deepEqual(await parse('"foo"="bar"'), { foo: "bar" });
});

test("should handle = as identifier", async (t) => {
  t.deepEqual(await parse('=="bar"'), { "=": "bar" });
});

test("should handle dashed identifiers", async (t) => {
  t.deepEqual(await parse("dashed-identifier=bar"), {
    "dashed-identifier": "bar",
  });
});

test("should handle values with colon sign", async (t) => {
  t.deepEqual(await parse("foo=bar:foo"), { foo: "bar:foo" });
});

test("should handle variables", async (t) => {
  t.deepEqual(await parse("@planet_standard_scale = 11"), {
    "@planet_standard_scale": 11,
  });
});

test("should handle interpolated variables", async (t) => {
  t.deepEqual(await parse("position = @[1-leopard_x]"), {
    "position": "@[1-leopard_x]",
  });
});

test("should handle empty number keys", async (t) => {
  t.deepEqual(await parse("unit={ 2={ } 14={ } }"), {
    unit: { 2: {}, 14: {} },
  });
});

test("should handle escaped double quotes", async (t) => {
  t.deepEqual(await parse('desc="\\"Captain\\""'), { desc: '"Captain"' });
});

test("should handle rgb", async (t) => {
  t.deepEqual(await parse("color = rgb { 100 200 150 }"), {
    color: { rgb: [100, 200, 150] },
  });
});

test("should handle less than operator", async (t) => {
  t.deepEqual(await parse("has_level < 2"), { has_level: { LESS_THAN: 2 } });
});

test("should handle less than operator quotes", async (t) => {
  t.deepEqual(await parse('"has_level2" < 2'), {
    has_level2: { LESS_THAN: 2 },
  });
});

test("should handle less than or equal to operator", async (t) => {
  t.deepEqual(await parse("has_level <= 2"), {
    has_level: { LESS_THAN_EQUAL: 2 },
  });
});

test("should handle less than or equal to operator quotes", async (t) => {
  t.deepEqual(await parse('"has_level2" <= 2'), {
    has_level2: { LESS_THAN_EQUAL: 2 },
  });
});

test("should handle greater than operator", async (t) => {
  t.deepEqual(await parse("has_level > 2"), { has_level: { GREATER_THAN: 2 } });
});

test("should handle greater than operator quotes", async (t) => {
  t.deepEqual(await parse('"has_level2" > 2'), {
    has_level2: { GREATER_THAN: 2 },
  });
});

test("should handle greater than or equal to operator", async (t) => {
  t.deepEqual(await parse("has_level >= 2"), {
    has_level: { GREATER_THAN_EQUAL: 2 },
  });
});

test("should handle greater than or equal to operator quotes", async (t) => {
  t.deepEqual(await parse('"has_level2" >= 2'), {
    has_level2: { GREATER_THAN_EQUAL: 2 },
  });
});

test("should handle less than operator object", async (t) => {
  t.deepEqual(await parse("has_level < 2 a = b"), {
    has_level: { LESS_THAN: 2 },
    a: "b",
  });
});

test("should serialize large numbers as strings", async (t) => {
  t.deepEqual(await parse("val = 18446744073709547616"), {
    val: "18446744073709547616",
  });
});

test("should serialize large negative numbers as strings", async (t) => {
  t.deepEqual(await parse("val = -90071992547409097"), {
    val: "-90071992547409097",
  });
});

test("should handle hsv", async (t) => {
  t.deepEqual(await parse("color = hsv { 0.5 0.2 0.8 }"), {
    color: { hsv: [0.5, 0.2, 0.8] },
  });
});

test("should handle windows1252", async (t) => {
  const jomini = await Jomini.initialize();
  const data = new Uint8Array([0xff, 0x3d, 0x8a]);
  const out = jomini.parseText(data, { encoding: "windows1252" });
  t.deepEqual(out, { ÿ: "Š" });
});

test("should handle utf8", async (t) => {
  t.deepEqual(await parse('name = "Jåhkåmåhkke"'), {
    name: "Jåhkåmåhkke",
  });
});

test("should parse with query callback", async (t) => {
  const jomini = await Jomini.initialize();
  const out = jomini.parseText(utf8encode("foo=bar qux=baz"), {}, (q) => {
    return { abc: q.at("/foo"), def: q.at("/qux") };
  });
  t.deepEqual(out, { abc: "bar", def: "baz" });
});

test("should parse with query callback number", async (t) => {
  const jomini = await Jomini.initialize();
  const out = jomini.parseText(utf8encode("foo=1 qux=baz"), {}, (q) =>
    q.at("/foo")
  );
  t.deepEqual(out, 1);
});

test("should parse with query callback date", async (t) => {
  const jomini = await Jomini.initialize();
  const out = jomini.parseText(utf8encode("foo=1444.11.11"), {}, (q) =>
    q.at("/foo")
  );
  t.deepEqual(out, new Date(Date.UTC(1444, 10, 11)));
});

test("should parse with query callback object", async (t) => {
  const jomini = await Jomini.initialize();
  const out = jomini.parseText(utf8encode("foo={name=jim}"), {}, (q) =>
    q.at("/foo")
  );
  t.deepEqual(out, { name: "jim" });
});

test("should parse with query callback nested object value", async (t) => {
  const jomini = await Jomini.initialize();
  const out = jomini.parseText(utf8encode("foo={name=jim}"), {}, (q) =>
    q.at("/foo/name")
  );
  t.deepEqual(out, "jim");
});

test("should parse string directly", async (t) => {
  const jomini = await Jomini.initialize();
  const out = jomini.parseText("foo={name=jim}");
  t.deepEqual(out, { foo: { name: "jim" } });
});

test("should parse readme example", async (t) => {
  const data = `
  date=1640.7.1
  player="FRA"
  savegame_version={
      first=1
      second=9
      third=2
      forth=0
  }`;

  const parser = await Jomini.initialize();
  const out = parser.parseText(data);
  const expected = {
    date: new Date(Date.UTC(1640, 6, 1)),
    player: "FRA",
    savegame_version: {
      first: 1,
      second: 9,
      third: 2,
      forth: 0,
    },
  };
  t.deepEqual(out, expected);
});

test("should parse subsequent unordered objects", async (t) => {
  const str = `
  name=aaa
  name=bbb
  core=123
  name=ccc
  name=ddd
  `;
  const expected = {
    name: ["aaa", "bbb", "ccc", "ddd"],
    core: 123,
  };
  t.deepEqual(await parse(str), expected);
});

test("should serialize to json", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "foo=bar";
  const expected = '{"foo":"bar"}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  t.deepEqual(out, expected);
});

test("should serialize to json simple types", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "foo=bar num=1 bool=no bool2=yes pi=3.14";
  const expected = '{"foo":"bar","num":1,"bool":false,"bool2":true,"pi":3.14}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  t.deepEqual(out, expected);
});

test("should serialize to json object", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "foo={prop=a bar={num=1}}";
  const expected = '{"foo":{"prop":"a","bar":{"num":1}}}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  t.deepEqual(out, expected);
});

test("should serialize to json array", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "nums={1 2 3 4}";
  const expected = '{"nums":[1,2,3,4]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  t.deepEqual(out, expected);
});

test("should serialize to json consecutive field values", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "core=AAA core=BBB";
  const expected = '{"core":["AAA","BBB"]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  t.deepEqual(out, expected);
});

test("should serialize to json header", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "color = rgb { 100 200 150 }";
  const expected = '{"color":{"rgb":[100,200,150]}}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  t.deepEqual(out, expected);
});

test("should serialize large numbers as strings in json", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "identity = 18446744073709547616";
  const expected = '{"identity":"18446744073709547616"}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  t.deepEqual(out, expected);
});

test("should serialize large negative numbers as strings in json", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "identity = -90071992547409097";
  const expected = '{"identity":"-90071992547409097"}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  t.deepEqual(out, expected);
});

test("should serialize to json object pretty", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "foo={prop=a bar={num=1}}";
  const expected = `{
  "foo": {
    "prop": "a",
    "bar": {
      "num": 1
    }
  }
}`;
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ pretty: true })
  );
  t.deepEqual(out, expected);
});

test("should serialize to json disambiguate keys", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "core=AAA core=BBB";
  const expected = '{"core":"AAA","core":"BBB"}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ disambiguate: "keys" })
  );
  t.deepEqual(out, expected);
});

test("should serialize to json disambiguate typed", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "core=AAA core=BBB";
  const expected = '{"type":"obj","val":[["core","AAA"],["core","BBB"]]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ disambiguate: "typed" })
  );
  t.deepEqual(out, expected);
});

test("should serialize to json disambiguate typed arrays", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "nums={1 2}";
  const expected =
    '{"type":"obj","val":[["nums",{"type":"array","val":[1,2]}]]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ disambiguate: "typed" })
  );
  t.deepEqual(out, expected);
});

test("should serialize object trailers to json", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "area = { color = { 10 } 1 2 }";
  const expected = '{"area":{"color":[10],"trailer":[1,2]}}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  t.deepEqual(out, expected);
});

test("should serialize object trailers to json keys", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "area = { color = { 10 } 1 2 }";
  const expected = '{"area":{"color":[10],"trailer":[1,2]}}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ disambiguate: "keys" })
  );
  t.deepEqual(out, expected);
});

test("should serialize object trailers to json typed", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "area = { color = { 10 } 1 2 }";
  const expected =
    '{"type":"obj","val":[["area",{"type":"obj","val":[["color",{"type":"array","val":[10]}],[1,2]]}]]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ disambiguate: "typed" })
  );
  t.deepEqual(out, expected);
});

test("should serialize parameter definitions to json typed", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "generate_advisor = { [[scaled_skill] a=b ] [[!scaled_skill] c=d ]  }";
  const expected =
    '{"type":"obj","val":[["generate_advisor",{"type":"obj","val":[["[scaled_skill]",{"type":"obj","val":[["a","b"]]}],["[!scaled_skill]",{"type":"obj","val":[["c","d"]]}]]}]]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ disambiguate: "typed" })
  );
  t.deepEqual(out, expected);
});

test("should serialize parameter definition value to json typed", async (t) => {
  const jomini = await Jomini.initialize();
  const str = "foo = { [[add] $add$]}";
  const expected = '{"type":"obj","val":[["foo",{"type":"obj","val":[["[add]","$add$"]]}]]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ disambiguate: "typed" })
  );
  t.deepEqual(out, expected);
});
