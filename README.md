# Jomini.js

Jomini is a javascript library that is able to parse **plaintext** save and game files from Paradox Development Studios (Europa Universalis IV, Crusader Kings III, and others)

> Aside: it's only by happenstance that this library and Paradox's own code share the same name (this library is older by several years).

## Features:

- ✔ Compatibility: Node 12+ and >90% of browsers
- ✔ Speed: Parse at nearly 200 MB/s
- ✔ Correctness: The same parser underpins [Rakaly](https://rakaly.com/eu4), the EU4 achievement leaderboard, and the [Paradox Game Converters's](https://github.com/ParadoxGameConverters/EU4toVic2) ironman to plaintext converter
- ✔ Ergonomic: Data parsed into plain javascript objects
- ✔ Small: Less than 50 KB when gzipped

## Install

```bash
npm i jomini
```

## Quick Start

```js
const { Jomini } = require("jomini");
// or import { Jomini } from "jomini";

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
