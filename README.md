![CI](https://github.com/nickbabcock/jomini/workflows/CI/badge.svg)
[![npm](https://img.shields.io/npm/v/jomini.svg)](http://npm.im/jomini)
[![size](https://badgen.net/bundlephobia/minzip/jomini)](https://bundlephobia.com/package/jomini)

# Jomini.js

Jomini is a javascript library that is able to read and write **plaintext** save and game files from Paradox Development Studios produced on the Clausewitz engine (Europa Universalis IV (eu4), Crusader Kings III (ck3), Hearts of Iron 4 (hoi4), Stellaris, and others)

> Aside: it's only by happenstance that this library and Paradox's own code share the same name (this library is older by several years).

## Features:

- ✔ Compatibility: Node 12+ and >90% of browsers
- ✔ Speed: Parse at over 200 MB/s
- ✔ Correctness: The same parser underpins a [EU4 save file analyzer](https://pdx.tools), and the [Paradox Game Converters's](https://github.com/ParadoxGameConverters/EU4toVic2) ironman to plaintext converter
- ✔ Ergonomic: Data parsed into plain javascript objects or JSON
- ✔ Self-contained: zero runtime dependencies
- ✔ Small: Less than 100 KB gzipped (or 70 KB when using the [slim entrypoint](#slim-module))

## Quick Start

Quick and easy way to add jomini to your project:

```html
<body>
  <script src="https://cdn.jsdelivr.net/npm/jomini@0.8.0/dist/umd/index.min.js"></script>
  <script>
    jomini.Jomini.initialize().then((parser) => {
      const out = parser.parseText("foo=bar");
      alert(`the value of foo is ${out.foo}`);
    });
  </script>
</body>
```

Or if you want a more efficient way to get started:

```html
<script type="module">
  import { Jomini } from 'https://cdn.jsdelivr.net/npm/jomini@0.8.0/dist/es-slim/index_slim.min.js';

  const wasmUrl = 'https://cdn.jsdelivr.net/npm/jomini@0.8.0/dist/jomini.wasm';
  Jomini.initialize({ wasm: wasmUrl })
    .then((parser) => {
      const out = parser.parseText('foo=bar');
      alert(`the value of foo is ${out.foo}`);
    });
</script>
```

Or if Node.js is targeted or one is bundling this inside a larger application:

```bash
npm i jomini
```

## Example

```js
import { Jomini } from "jomini";

const data = `
    date=1640.7.1
    player="FRA"
    savegame_version={
        first=1
        second=9
        third=2
        forth=0
    }`

const parser = await Jomini.initialize();
const out = parser.parseText(data);
```

Will return the following:

```js
out = {
    date: new Date(Date.UTC(1640, 6, 1)),
    player: "FRA",
    savegame_version: {
        first: 1,
        second: 9,
        third: 2,
        forth: 0
    }
}
```

## Encoding

It's preferable to pass in raw bytes to `parseText` and to optionally pass in an encoding (which defaults to `utf8`) instead of passing in a string as this tends to be more efficient.

If passing in bytes to `parseText`, make sure to specify an encoding, else the strings could be deserialized incorrectly:

```js
const jomini = await Jomini.initialize();
const data = new Uint8Array([0xff, 0x3d, 0x8a]);
const out = jomini.parseText(data, { encoding: "windows1252" });
// out = { ÿ: "Š" }
```

## Type Narrowing

By default, jomini will attempt to narrow all values to more specific types like numbers, dates, or booleans. Type narrowing can be configured to only occur for unquoted values or disabled altogether.

```js
const jomini = await Jomini.initialize();
const { root, json } = jomini.parseText(
  'a="01" b=02 c="yes" d=no',
  {
    typeNarrowing: "unquoted",
  },
  (q) => ({ root: q.root(), json: q.json() })
);

expect(root).toEqual({
  a: "01",
  b: 2,
  c: "yes",
  d: false,
});

expect(json).toEqual('{"a":"01","b":2,"c":"yes","d":false}');
```

## Performance

95-99% of the time it takes to parse a file is creating the Javascript object, so it is preferable if one can slim the object down as much as possible. This is why `parseText` accepts a callback where one can provide JSON pointer like strings to extract only the data that is necessary.

Below shows an example of extracting the player's prestige from an EU4 save file

```js
const buffer = readFileSync(args[0]);
const parser = await Jomini.initialize();
const { player, prestige } = parser.parseText(
  buffer,
  { encoding: "windows1252" },
  (query) => {
    const player = query.at("/player");
    const prestige = query.at(`/countries/${player}/prestige`);
    return { player, prestige };
  }
);
```

The alternative would be:

```js
const buffer = readFileSync(args[0]);
const parser = await Jomini.initialize();
const save = parser.parseText(buffer, { encoding: "windows1252" });
const player = save.player;
const prestige = save.countries[player].prestige;
```

The faster version completes 40x faster (6.3s vs 0.16s) and uses about half the memory.

## JSON

There is a middle ground in terms of performance and flexibility: using JSON as an intermediate layer:

```js
const buffer = readFileSync(args[0]);
const parser = await Jomini.initialize();
const out = parser.parseText(buffer, { encoding: "windows1252" }, (q) => q.json());
const save = JSON.parse(out);
const player = save.player;
const prestige = save.countries[player].prestige;
```

The keys of the stringified JSON object are in the order as they appear in the file, so this makes the JSON approach well suited for parsing files where the order of object keys matter. The other APIs are subjected to natively constructed JS objects reordering keys to suit their fancy. To process the JSON and not lose key order, you'll want to leverage a streaming JSON parser like [oboe.js](https://github.com/jimhigson/oboe.js) or [stream-json](https://github.com/uhop/stream-json).

Interestingly, even though using JSON adds a layer, constructing and parsing the JSON into a JS object is still 3x faster than when a JS object is constructed directly. This must be a testament to how tuned browser JSON parsers are.

The JSON format does not change how dates are encoded, so dates are written into the JSON exactly as they appear in the original file.

The JSON generator contains options to tweak the output.

To pretty print the output:

```js
parser.parseText(buffer, { }, (q) => q.json({ pretty: true }));
```

There is an option to decide how duplicate keys are serialized. For instance, given the following data:

```
core="AAA"
core="BBB"
```

The default behavior will group the two fields into one list, as shown below. This favors ergonomics, as the builtin `JSON.parse` doesn't handle duplicate keys well.

```json
{
  "core": ["AAA", "BBB"]
}
```

If this behavior is not desirable, it can be tweaked such that the duplicate keys are preserved:

```js
parser.parseText(buffer, { }, (q) => q.json({ duplicateKeyMode: "preserve" }));
```

will output:

```json
{
  "core": "AAA",
  "core": "BBB"
}
```

Whether or not the above is [valid JSON is debateable](https://stackoverflow.com/q/21832701).

The remaining mode transforms key value objects to an array of key value tuples:

```js
parser.parseText(buffer, { }, (q) => q.json({ duplicateKeyMode: "key-value-pairs" }));
```

will output:

```json
{
  "type": "obj",
  "val": [
    ["core", "AAA"],
    ["core", "BBB"]
  ]
}
```

The output is ugly and verbose, but it's valid JSON and preserves the original structure. Arrays will have the type of `array`.

## Data Mangling

The PDS data format is ambiguous without additional context in certain situations. A great example of this are EU4 armies. If a country only has a single army, then the parser will assume that `army` is singular object instead of an array. This can also been seen with individual units nested in an `army`. Below is an example of two armies, one army has a single unit while the other has multiple.

```
army={
  name="1st army"
  unit={ name="1st unit" }
}
army={
  name="2nd army"
  unit={ name="2nd unit" }
  unit={ name="3rd unit" }
}
```

Without intervention the parsed structure will be:

```js
out = {
  army: [
    {
      name: "1st army",
      unit: { name: "1st unit", },
    },
    {
      name: "2nd army",
      unit: [
        { name: "2nd unit", },
        { name: "3rd unit", },
      ],
    },
  ],
}

// `army[0].unit` is an object
// `army[1].unit` is an array! 
```

This is remedied by passing the parsed struct through `toArray` and targeting the `army.unit` property 

```js
toArray(obj, "army.unit");
const expected = {
  army: [
    {
      name: "1st army",
      unit: [{ name: "1st unit", }, ],
    },
    {
      name: "2nd army",
      unit: [
        { name: "2nd unit", },
        { name: "3rd unit", },
      ],
    },
  ],
};
```

## Write API

The write API is low level in order to clear out any ambiguities that may arise from a higher level API.

```js
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
```

The return value will be a byte array that contains the following:

```plain
data={
  settings={
    0 1
  }
  name="world"
}
color=rgb {
  100 150 74
}
start=1444.11.11
```

There is not yet an official high level API to write out arbitrary objects; however, one can adapt [this solution](https://github.com/nickbabcock/jomini/issues/5#issuecomment-1564253958) until a high level API is decided to be implemented. 

## Slim Module

By default, the `jomini` entrypoint includes Wasm that is base64 inlined. This is the default as most developers will probably not need to care. However some developers will care: those running the library in environments where Wasm is executable but not compilable or those who are ambitious about reducing compute and bandwidth costs for their users.

To cater to these use cases, there is a `jomini/slim` package that operates the exactly the same except now it is expected for developers to prime initialization through some other means:

```js
import { Jomini } from "jomini/slim";
import wasm from "jomini/jomini.wasm";

const data = `player="FRA"`;
const parser = await Jomini.initialize({ wasm });
const out = parser.parseText(data);
```

## Deno

Deno is currently supported through their npm specifier. Jomini requires `--allow-read` permissions.

```ts
import { Jomini } from "npm:jomini@0.8.0";

const data = await Deno.readAll(Deno.stdin);
const parser = await Jomini.initialize();
const out = parser.parseText(
  data,
  { encoding: "windows1252" },
  (query) => query.json(),
);

console.log(out);
```
