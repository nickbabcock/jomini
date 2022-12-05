import { expect, it } from "vitest";
import {
  Jomini,
  toArray,
  Query,
  Writer,
  JominiLoadOptions,
  JsonOptions,
} from "..";
import fs from "fs/promises";

const encoder = new TextEncoder();
const utf8encode = (s: string) => encoder.encode(s);

async function parse(s: string): Promise<Record<string, any>>;
async function parse<T>(s: string, q: (arg0: Query) => T): Promise<T>;

async function parse<T>(s: string, q?: (arg0: Query) => T) {
  const jomini = await Jomini.initialize();
  const data = utf8encode(s);
  if (q) {
    return jomini.parseText(data, { encoding: "utf8" }, q);
  } else {
    return jomini.parseText(data, { encoding: "utf8" });
  }
}

it("can instantiate parser", async () => {
  const a = await Jomini.initialize();
  expect(a).toBeDefined();

  // Make sure we can call it again
  const b = await Jomini.initialize();
  expect(b).toBeDefined();
});

it("should handle the simple parse case", async () => {
  expect(await parse("foo=bar")).toEqual({ foo: "bar" });
});

it("should handle the simple header case", async () => {
  expect(await parse("EU4txt\nfoo=bar")).toEqual({ foo: "bar" });
});

it("should handle empty quoted strings", async () => {
  expect(await parse('foo=""')).toEqual({ foo: "" });
});

it("should handle whitespace", async () => {
  expect(await parse("\tfoo = bar ")).toEqual({ foo: "bar" });
});

it("should handle the simple quoted case", async () => {
  expect(await parse('foo="bar"')).toEqual({ foo: "bar" });
});

it("should handle string list accumulation long", async () => {
  expect(await parse("foo=bar\nfoo=qux\nfoo=baz")).toEqual({
    foo: ["bar", "qux", "baz"],
  });
});

it("should handle quoted string list accumulation", async () => {
  expect(await parse('foo="bar"\nfoo="qux"')).toEqual({ foo: ["bar", "qux"] });
});

it("should handle boolean", async () => {
  expect(await parse("foo=yes")).toEqual({ foo: true });
});

it("should handle boolen list", async () => {
  expect(await parse("foo={yes no}")).toEqual({ foo: [true, false] });
});

it("should handle whole numbers", async () => {
  expect(await parse("foo=1")).toEqual({ foo: 1 });
});

it("should handle zero", async () => {
  expect(await parse("foo=0")).toEqual({ foo: 0 });
});

it("should handle negative whole numbers", async () => {
  expect(await parse("foo=-1")).toEqual({ foo: -1 });
});

it("should handle decimal number", async () => {
  expect(await parse("foo=1.23")).toEqual({ foo: 1.23 });
});

it("should handle negative decimal number", async () => {
  expect(await parse("foo=-1.23")).toEqual({ foo: -1.23 });
});

it("should handle negative decimal number regression", async () => {
  expect(await parse("foo=-0.5")).toEqual({ foo: -0.5 });
});

it("should handle positive decimal number", async () => {
  expect(await parse("foo = +0.5")).toEqual({ foo: 0.5 });
});

it("should handle number list accumulation", async () => {
  expect(await parse("foo=1\nfoo=-1.23")).toEqual({ foo: [1, -1.23] });
});

it("should handle dates", async () => {
  expect(await parse("date=1821.1.1")).toEqual({
    date: new Date(Date.UTC(1821, 0, 1)),
  });
});

it("should deceptive dates", async () => {
  expect(await parse("date=1821.a.1")).toEqual({ date: "1821.a.1" });
});

it("should handle quoted dates", async () => {
  expect(await parse('date="1821.1.1"')).toEqual({
    date: new Date(Date.UTC(1821, 0, 1)),
  });
});

it("should handle accumulated dates", async () => {
  expect(await parse('date="1821.1.1"\ndate=1821.2.1')).toEqual({
    date: [new Date(Date.UTC(1821, 0, 1)), new Date(Date.UTC(1821, 1, 1))],
  });
});

it("should parse negative dates", async () => {
  expect(await parse("date=-17.1.1")).toEqual({
    date: new Date(Date.UTC(-17, 0, 1)),
  });
});

it("should parse large negative dates", async () => {
  expect(await parse("date=-2500.1.1")).toEqual({
    date: new Date(Date.UTC(-2500, 0, 1)),
  });
});

it("should handle numbers as identifiers", async () => {
  expect(await parse("158=10")).toEqual({ 158: 10 });
});

it("should handle periods in identifiers", async () => {
  expect(await parse("flavor_tur.8=yes")).toEqual({ "flavor_tur.8": true });
});

it("should handle consecutive strings", async () => {
  expect(await parse("foo = { bar baz }")).toEqual({ foo: ["bar", "baz"] });
});

it("should handle consecutive strings no space", async () => {
  expect(await parse("foo={bar baz}")).toEqual({ foo: ["bar", "baz"] });
});

it("should handle consecutive quoted strings", async () => {
  expect(await parse('foo = { "bar" "baz" }')).toEqual({ foo: ["bar", "baz"] });
});

it("should handle empty object", async () => {
  expect(await parse("foo = {}")).toEqual({ foo: {} });
});

it("should handle parameter definition value", async () => {
  expect(await parse("foo = { [[add] $add$]}")).toEqual({
    foo: { "[add]": "$add$" },
  });
});

it("should handle parameter definitions", async () => {
  expect(await parse("foo = { [[add] if={a=b}]}")).toEqual({
    foo: { "[add]": { if: { a: "b" } } },
  });
});

it("should handle undefined parameter definitions", async () => {
  expect(await parse("foo = { [[!add] if={a=b}]}")).toEqual({
    foo: { "[!add]": { if: { a: "b" } } },
  });
});

it("should parse through extra trailing brace", async () => {
  expect(await parse("foo = { bar } }")).toEqual({ foo: ["bar"] });
});

it("should parse through any extra braces", async () => {
  expect(await parse("a = { 10 } } b = yes")).toEqual({ a: [10], b: true });
});

it("should handle space empty object", async () => {
  expect(await parse("foo = { }")).toEqual({ foo: {} });
});

it("should handle empty objects for dates", async () => {
  expect(await parse("1920.1.1={}")).toEqual({ "1920.1.1": {} });
});

it("should handle the object after empty object", async () => {
  const obj = {
    foo: {},
    catholic: {
      defender: "me",
    },
  };
  expect(await parse('foo={} catholic={defender="me"}')).toEqual(obj);
});

it("should handle the object after empty object nested", async () => {
  const obj = {
    religion: {
      foo: {},
      catholic: {
        defender: "me",
      },
    },
  };

  expect(await parse('religion={foo={} catholic={defender="me"}}')).toEqual(
    obj
  );
});

it("should ignore empty objects with no identifier at end", async () => {
  expect(await parse("foo={bar=val {}}  { } me=you")).toEqual({
    foo: { bar: "val" },
    me: "you",
  });
});

it("should understand a list of objects", async () => {
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
  expect(await parse(str)).toEqual(obj);
});

it("should parse minimal spacing for objects", async () => {
  const str = 'nation={ship={name="ship1"} ship={name="ship2"}}';
  const obj = {
    nation: {
      ship: [{ name: "ship1" }, { name: "ship2" }],
    },
  };
  expect(await parse(str)).toEqual(obj);
});

it("should understand a simple EU4 header", async () => {
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
  expect(await parse(str)).toEqual(obj);
});

it("should understand EU4 gameplay settings", async () => {
  const str =
    "gameplaysettings=\r\n{\r\n\tsetgameplayoptions=" +
    "\r\n\t{\r\n\t\t1 1 2 0 1 0 0 0 1 1 1 1 \r\n\t}\r\n}";
  const obj = {
    gameplaysettings: {
      setgameplayoptions: [1, 1, 2, 0, 1, 0, 0, 0, 1, 1, 1, 1],
    },
  };
  expect(await parse(str)).toEqual(obj);
});

it("should parse multiple objects accumulated", async () => {
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
  expect(await parse(str)).toEqual(obj);

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
  expect(obj).toEqual(expected);
});

it("should handle back to backs", async () => {
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
  expect(await parse(str1 + str2)).toEqual(obj);
});

it("should understand mixed containers", async () => {
  expect(await parse("area = { color = { 10 } 1 2 }")).toEqual({
    area: { color: [10], remainder: [1, 2] },
  });
});

it("should understand comments mean skip line", async () => {
  expect(await parse("# boo\r\n# baa\r\nfoo=a\r\n# bee")).toEqual({ foo: "a" });
});

it("should understand simple objects", async () => {
  expect(await parse("foo={bar=val}")).toEqual({ foo: { bar: "val" } });
});

it("should understand nested list objects", async () => {
  expect(await parse("foo={bar={val}}")).toEqual({ foo: { bar: ["val"] } });
});

it("should understand objects with start spaces", async () => {
  expect(await parse("foo= { bar=val}")).toEqual({ foo: { bar: "val" } });
});

it("should understand objects with end spaces", async () => {
  expect(await parse("foo={bar=val }")).toEqual({ foo: { bar: "val" } });
});

it("should ignore empty objects with no identifier", async () => {
  expect(await parse("foo={bar=val} {} { } me=you")).toEqual({
    foo: { bar: "val" },
    me: "you",
  });
});

it("should handle strings as identifiers", async () => {
  expect(await parse('"foo"="bar"')).toEqual({ foo: "bar" });
});

it("should handle = as identifier", async () => {
  expect(await parse('=="bar"')).toEqual({ "=": "bar" });
});

it("should handle dashed identifiers", async () => {
  expect(await parse("dashed-identifier=bar")).toEqual({
    "dashed-identifier": "bar",
  });
});

it("should handle values with colon sign", async () => {
  expect(await parse("foo=bar:foo")).toEqual({ foo: "bar:foo" });
});

it("should handle variables", async () => {
  expect(await parse("@planet_standard_scale = 11")).toEqual({
    "@planet_standard_scale": 11,
  });
});

it("should handle interpolated variables", async () => {
  expect(await parse("position = @[1-leopard_x]")).toEqual({
    position: "@[1-leopard_x]",
  });
});

it("should handle empty number keys", async () => {
  expect(await parse("unit={ 2={ } 14={ } }")).toEqual({
    unit: { 2: {}, 14: {} },
  });
});

it("should handle escaped double quotes", async () => {
  expect(await parse('desc="\\"Captain\\""')).toEqual({ desc: '"Captain"' });
});

it("should handle rgb", async () => {
  expect(await parse("color = rgb { 100 200 150 }")).toEqual({
    color: { rgb: [100, 200, 150] },
  });
});

it("should handle less than operator", async () => {
  expect(await parse("has_level < 2")).toEqual({ has_level: { LESS_THAN: 2 } });
});

it("should handle less than operator quotes", async () => {
  expect(await parse('"has_level2" < 2')).toEqual({
    has_level2: { LESS_THAN: 2 },
  });
});

it("should handle less than or equal to operator", async () => {
  expect(await parse("has_level <= 2")).toEqual({
    has_level: { LESS_THAN_EQUAL: 2 },
  });
});

it("should handle less than or equal to operator quotes", async () => {
  expect(await parse('"has_level2" <= 2')).toEqual({
    has_level2: { LESS_THAN_EQUAL: 2 },
  });
});

it("should handle greater than operator", async () => {
  expect(await parse("has_level > 2")).toEqual({
    has_level: { GREATER_THAN: 2 },
  });
});

it("should handle greater than operator quotes", async () => {
  expect(await parse('"has_level2" > 2')).toEqual({
    has_level2: { GREATER_THAN: 2 },
  });
});

it("should handle greater than or equal to operator", async () => {
  expect(await parse("has_level >= 2")).toEqual({
    has_level: { GREATER_THAN_EQUAL: 2 },
  });
});

it("should handle greater than or equal to operator quotes", async () => {
  expect(await parse('"has_level2" >= 2')).toEqual({
    has_level2: { GREATER_THAN_EQUAL: 2 },
  });
});

it("should handle less than operator object", async () => {
  expect(await parse("has_level < 2 a = b")).toEqual({
    has_level: { LESS_THAN: 2 },
    a: "b",
  });
});

it("should serialize large numbers as strings", async () => {
  expect(await parse("val = 18446744073709547616")).toEqual({
    val: "18446744073709547616",
  });
});

it("should serialize large negative numbers as strings", async () => {
  expect(await parse("val = -90071992547409097")).toEqual({
    val: "-90071992547409097",
  });
});

it("should handle hsv", async () => {
  expect(await parse("color = hsv { 0.5 0.2 0.8 }")).toEqual({
    color: { hsv: [0.5, 0.2, 0.8] },
  });
});

it("should handle windows1252", async () => {
  const jomini = await Jomini.initialize();
  const data = new Uint8Array([0xff, 0x3d, 0x8a]);
  const out = jomini.parseText(data, { encoding: "windows1252" });
  expect(out).toEqual({ ÿ: "Š" });
});

it("should handle utf8", async () => {
  expect(await parse('name = "Jåhkåmåhkke"')).toEqual({
    name: "Jåhkåmåhkke",
  });
});

it("should parse with query callback", async () => {
  const jomini = await Jomini.initialize();
  const out = jomini.parseText(utf8encode("foo=bar qux=baz"), {}, (q) => {
    return { abc: q.at("/foo"), def: q.at("/qux") };
  });
  expect(out).toEqual({ abc: "bar", def: "baz" });
});

it("should parse with query callback number", async () => {
  const jomini = await Jomini.initialize();
  const out = jomini.parseText(utf8encode("foo=1 qux=baz"), {}, (q) =>
    q.at("/foo")
  );
  expect(out).toEqual(1);
});

it("should parse with query callback date", async () => {
  const jomini = await Jomini.initialize();
  const out = jomini.parseText(utf8encode("foo=1444.11.11"), {}, (q) =>
    q.at("/foo")
  );
  expect(out).toEqual(new Date(Date.UTC(1444, 10, 11)));
});

it("should parse with query callback object", async () => {
  const jomini = await Jomini.initialize();
  const out = jomini.parseText(utf8encode("foo={name=jim}"), {}, (q) =>
    q.at("/foo")
  );
  expect(out).toEqual({ name: "jim" });
});

it("should parse with query callback nested object value", async () => {
  const jomini = await Jomini.initialize();
  const out = jomini.parseText(utf8encode("foo={name=jim}"), {}, (q) =>
    q.at("/foo/name")
  );
  expect(out, "jim");
});

it("should parse string directly", async () => {
  const jomini = await Jomini.initialize();
  const out = jomini.parseText("foo={name=jim}");
  expect(out).toEqual({ foo: { name: "jim" } });
});

it("should parse readme example", async () => {
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
  expect(out).toEqual(expected);
});

it("should parse subsequent unordered objects", async () => {
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
  expect(await parse(str)).toEqual(expected);
});

it("should serialize to json", async () => {
  const jomini = await Jomini.initialize();
  const str = "foo=bar";
  const expected = '{"foo":"bar"}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  expect(out).toEqual(expected);
});

it("should serialize to json simple types", async () => {
  const jomini = await Jomini.initialize();
  const str = "foo=bar num=1 bool=no bool2=yes pi=3.14";
  const expected = '{"foo":"bar","num":1,"bool":false,"bool2":true,"pi":3.14}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  expect(out).toEqual(expected);
});

it("should serialize to json object", async () => {
  const jomini = await Jomini.initialize();
  const str = "foo={prop=a bar={num=1}}";
  const expected = '{"foo":{"prop":"a","bar":{"num":1}}}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  expect(out).toEqual(expected);
});

it("should serialize to json array", async () => {
  const jomini = await Jomini.initialize();
  const str = "nums={1 2 3 4}";
  const expected = '{"nums":[1,2,3,4]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  expect(out).toEqual(expected);
});

it("should serialize to json consecutive field values", async () => {
  const jomini = await Jomini.initialize();
  const str = "core=AAA core=BBB";
  const expected = '{"core":["AAA","BBB"]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  expect(out).toEqual(expected);
});

it("should serialize to json header", async () => {
  const jomini = await Jomini.initialize();
  const str = "color = rgb { 100 200 150 }";
  const expected = '{"color":{"rgb":[100,200,150]}}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  expect(out).toEqual(expected);
});

it("should serialize large numbers as strings in json", async () => {
  const jomini = await Jomini.initialize();
  const str = "identity = 18446744073709547616";
  const expected = '{"identity":"18446744073709547616"}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  expect(out).toEqual(expected);
});

it("should serialize large negative numbers as strings in json", async () => {
  const jomini = await Jomini.initialize();
  const str = "identity = -90071992547409097";
  const expected = '{"identity":"-90071992547409097"}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  expect(out).toEqual(expected);
});

it("should serialize to json object pretty", async () => {
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
  const opts: JsonOptions = { pretty: true };
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json(opts));
  expect(out).toEqual(expected);
});

it("should serialize to json duplicate key mode preserve", async () => {
  const jomini = await Jomini.initialize();
  const str = "core=AAA core=BBB";
  const expected = '{"core":"AAA","core":"BBB"}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ duplicateKeyMode: "preserve" })
  );
  expect(out).toEqual(expected);
});

it("should serialize to json duplicate key mode typed", async () => {
  const jomini = await Jomini.initialize();
  const str = "core=AAA core=BBB";
  const expected = '{"type":"obj","val":[["core","AAA"],["core","BBB"]]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ duplicateKeyMode: "key-value-pairs" })
  );
  expect(out).toEqual(expected);
});

it("should serialize to json duplicate key mode typed arrays", async () => {
  const jomini = await Jomini.initialize();
  const str = "nums={1 2}";
  const expected =
    '{"type":"obj","val":[["nums",{"type":"array","val":[1,2]}]]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ duplicateKeyMode: "key-value-pairs" })
  );
  expect(out).toEqual(expected);
});

it("should serialize object trailers to json", async () => {
  const jomini = await Jomini.initialize();
  const str = "area = { color = { 10 } 1 2 }";
  const expected = '{"area":{"color":[10],"remainder":[1,2]}}';
  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  expect(out).toEqual(expected);
});

it("should serialize object trailers to json keys", async () => {
  const jomini = await Jomini.initialize();
  const str = "area = { color = { 10 } 1 2 }";
  const expected = '{"area":{"color":[10],"remainder":[1,2]}}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ duplicateKeyMode: "preserve" })
  );
  expect(out).toEqual(expected);
});

it("should serialize object trailers to json typed", async () => {
  const jomini = await Jomini.initialize();
  const str = "area = { color = { 10 } 1 2 }";
  const expected =
    '{"type":"obj","val":[["area",{"type":"obj","val":[["color",{"type":"array","val":[10]}],[1,2]]}]]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ duplicateKeyMode: "key-value-pairs" })
  );
  expect(out).toEqual(expected);
});

it("should serialize mixed objects to json", async () => {
  const jomini = await Jomini.initialize();
  const str = `
  on_actions = {
    faith_holy_order_land_acquisition_pulse
    delay = { days = { 5 10 }}
    faith_heresy_events_pulse
    delay = { days = { 15 20 }}
    faith_fervor_events_pulse
  }
`;
  const expected =
    '{"on_actions":["faith_holy_order_land_acquisition_pulse",{"delay":{"days":[5,10]}},"faith_heresy_events_pulse",{"delay":{"days":[15,20]}},"faith_fervor_events_pulse"]}';

  const out = jomini.parseText(utf8encode(str), {}, (q) => q.json());
  expect(out).toEqual(expected);
});

it("should serialize mixed objects to json keys", async () => {
  const jomini = await Jomini.initialize();
  const str = `
  on_actions = {
    faith_holy_order_land_acquisition_pulse
    delay = { days = { 5 10 }}
    faith_heresy_events_pulse
    delay = { days = { 15 20 }}
    faith_fervor_events_pulse
  }
`;
  const expected =
    '{"on_actions":["faith_holy_order_land_acquisition_pulse",{"delay":{"days":[5,10]}},"faith_heresy_events_pulse",{"delay":{"days":[15,20]}},"faith_fervor_events_pulse"]}';

  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ duplicateKeyMode: "preserve" })
  );
  expect(out).toEqual(expected);
});

it("should serialize parameter definitions to json typed", async () => {
  const jomini = await Jomini.initialize();
  const str =
    "generate_advisor = { [[scaled_skill] a=b ] [[!scaled_skill] c=d ]  }";
  const expected =
    '{"type":"obj","val":[["generate_advisor",{"type":"obj","val":[["[scaled_skill]",{"type":"obj","val":[["a","b"]]}],["[!scaled_skill]",{"type":"obj","val":[["c","d"]]}]]}]]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ duplicateKeyMode: "key-value-pairs" })
  );
  expect(out).toEqual(expected);
});

it("should serialize parameter definition value to json typed", async () => {
  const jomini = await Jomini.initialize();
  const str = "foo = { [[add] $add$]}";
  const expected =
    '{"type":"obj","val":[["foo",{"type":"obj","val":[["[add]","$add$"]]}]]}';
  const out = jomini.parseText(utf8encode(str), {}, (q) =>
    q.json({ duplicateKeyMode: "key-value-pairs" })
  );
  expect(out).toEqual(expected);
});

it("should write simple fields", async () => {
  const jomini = await Jomini.initialize();
  const out = jomini.write((writer: Writer) => {
    writer.write_integer(1);
    writer.write_integer(2);
    writer.write_unquoted("foo");
    writer.write_quoted("bar");
  });

  expect(new TextDecoder().decode(out)).toEqual('1=2\nfoo="bar"');
});

it("should write mixed object", async () => {
  const jomini = await Jomini.initialize();
  const out = jomini.write((writer) => {
    writer.write_unquoted("foo");
    writer.write_array_start();
    writer.write_integer(1);
    writer.start_mixed_mode();
    writer.write_unquoted("qux");
    writer.write_operator("=");
    writer.write_unquoted("bar");
    writer.write_unquoted("a");
    writer.write_operator("=");
    writer.write_unquoted("b");
    writer.write_end();
    writer.write_unquoted("f");
    writer.write_unquoted("d");
  });

  expect(new TextDecoder().decode(out)).toEqual(
    "foo={\n  1 qux=bar a=b\n}\nf=d"
  );
});

it("should write readme example", async () => {
  const jomini = await Jomini.initialize();
  const out = jomini.write((writer) => {
    writer.write_unquoted("data");
    writer.write_object_start();
    writer.write_unquoted("settings");
    writer.write_array_start();
    writer.write_integer(0);
    writer.write_integer(1);
    writer.write_end();
    writer.write_unquoted("name");
    writer.write_quoted("world");
    writer.write_end();
    writer.write_unquoted("color");
    writer.write_header("rgb");
    writer.write_array_start();
    writer.write_integer(100);
    writer.write_integer(150);
    writer.write_integer(74);
    writer.write_end();
    writer.write_unquoted("start");
    writer.write_date(new Date(Date.UTC(1444, 10, 11)));
  });

  expect(new TextDecoder().decode(out)).toEqual(
    'data={\n  settings={\n    0 1\n  }\n  name="world"\n}\ncolor=rgb {\n  100 150 74\n}\nstart=1444.11.11'
  );
});

it("should read and write hour date", async () => {
  const jomini = await Jomini.initialize();
  const obj = await parse("start_date=1936.1.1.1");
  const out = jomini.write((writer) => {
    writer.write_unquoted("start_date");
    writer.write_date(obj.start_date, { hour: true });
  });

  expect(new TextDecoder().decode(out)).toEqual("start_date=1936.1.1.1");
});

it("should write escaped text", async () => {
  const jomini = await Jomini.initialize();
  const out = jomini.write((writer) => {
    writer.write_unquoted("name");
    writer.write_quoted('Project "Eagle"');
  });

  expect(new TextDecoder().decode(out)).toEqual('name="Project \\"Eagle\\""');
});

it("should allow custom initialization", async () => {
  let jomini = await Jomini.initialize();
  Jomini.resetModule();
  const wasm = await fs.readFile("dist/jomini.wasm");
  const opts: JominiLoadOptions = { wasm };
  jomini = await Jomini.initialize(opts);

  const out = jomini.parseText("foo=bar");
  expect(out).toEqual({ foo: "bar" });
});
