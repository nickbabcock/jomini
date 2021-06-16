## v0.5.0 - 2021-06-16

- Add low level write API. [See readme](https://github.com/nickbabcock/jomini/tree/ffe5a94ed2e3c070557cf96f38210b693f203cf5#write-api) for more info
- Skip creating empty objects values that don't have an associated key. The example below shows the new behavior
```js
// foo={bar=val {}}  { } me=you
{
  foo: { bar: 'val' },
  me: "you"
}
```
- Internal method of `Query::free` is no longer exposed.
- Minor parsing performance improvement

## v0.4.9 - 2021-04-27

Support for prehistoric Eu4 Leviathan monument dates

## v0.4.8 - 2021-04-26

Support for Ck3 interpolated variable syntax:

```
position = @[1-leopard_x]
```

## v0.4.7 - 2021-04-07

Support for Eu4 parameter definition syntax:

```
each_estate_effect = {
  if = {
      limit = {
              has_estate = estate_brahmins
      }
      [[effect] $effect$]
      [[estate_action]
        $estate_action$ = estate_brahmins
      ]
  }
}
```

## v0.4.6 - 2021-03-27

Allow extraneous closing brace at any point. Previously extraneous closing
braces could only be at the end of the document (something seen in Vic II
saves), but there are EU4 game files where an extraneous closing brace ocurrs
in the middle (looking at you verona.txt):

```
a = { 1 }
}
b = 2
```

This release makes the parser purposely accept invalid documents in an
effort to be as flexible as possible. Any file that is parseable by PDS
should be parseable by us.

## v0.4.5 - 2021-03-25

Fix inaccuracy in float parsing numbers in the range of (-1, 0). Previously

```
foo=-0.5
```

and

```
foo=0.5
```

would parse to the same value. This has been fixed.

## v0.4.4 - 2021-03-24

Added the ability to properly expose a document with an object trailer:

```
area = { color = { 10 } 1 2 }
```

The trailing "1 2" is referred to as the object trailer and will now be
exposed as the `trailer` property:

```js
area: { color: [10], trailer: [1, 2] }
```

## v0.4.3 - 2021-03-14

- Bug fixes to internal parser to properly handle more edge cases (unseen in the wild) instead of panicking

## v0.4.2 - 2021-03-09

- Add option to prettify JSON output
- Add option to define how to deal with duplicate keys when generating JSON
- Enhance types on `Query` object

## v0.4.1 - 2021-03-09

Fix wasm not being bundled inside the JS distribution

## v0.4.0 - 2021-03-08

New API: requesting the parsed file be converted to JSON:

```js
const parser = await Jomini.initialize();
const jsonString = parser.parseText(
  buffer, 
  { encoding: "windows1252" },
  (q) => q.json()
);
```

The JSON will contain object keys in the order as they appear in the file (instead of it being browser dependent). The JSON API is fast too, producing the JSON and then parsing the JSON is still 3x faster than parsing the file directly to a JS object.

Additionally integers that can't losslessly represented by a 64 bit floating point number are now represented as strings instead of numbers with a loss of precision.

## v0.3.10 - 2021-02-18

Support for parsing Victoria II saves that contain an extraneous closing brace

## v0.3.9 - 2020-12-09

Support for parsing negative dates

## v0.3.8 - 2020-11-05

Fix some typescript typing on optional arguments to `parseText`

## v0.3.7 - 2020-10-20

Aggregate fields that are out of order under a single field

```plain
name=aaa
name=bbb
core=123
name=ccc
name=ddd
```

is parsed into:

```js
{
    name: ["aaa", "bbb", "ccc", "ddd"],
    core: 123,
}
```

## v0.3.6 - 2020-10-14

Fix path to typescript types

## v0.3.5 - 2020-10-12

10-20% parsing performance improvement

## v0.3.4 - 2020-10-06

Fix parsing of the following format that can occur in EU4 saves:

```
history = {
  {}
  1689.10.2={
    decision="abc123"
  }
}
```

## v0.3.3 - 2020-10-04

- Fix webpack compatibility
- Wasm inlined as base64 so browser users don't need to fetch an additional file

## v0.3.2 - 2020-10-04

This library has been rewritten and hopefully by the end there'll be enough evidence to make the rewrite worth it.

The two major reasons why the library was rewritten:

- Performance: Prior versions of the library are unable to parse large save files, as this would often exhaust node's heap space and parsing could take up to 30 seconds. 
- Accuracy: Some inputs would cause the parser to crash for unknown reasons and the parser generator used didn't allow enough insight to easily debug the situation.

So it was decided to adopt the parser that underpins [Rakaly](https://rakaly.com/eu4), the EU4 achievement leaderboard, and the [Paradox Game Converters's](https://github.com/ParadoxGameConverters/EU4toVic2) conversion from ironman to plaintext.

Given the same input, the new parser is over 3x faster and uses a third of the memory. And since this parser is much more flexible, it should handle inputs that previous versions could not.

What could be a real game changer is that this version introduces a query api on the parsed input that allow this version to be 200x faster than previously.

So while one can compute the player's prestige from an EU4 save with:

```js
const buffer = readFileSync(args[0]);
const parser = await Jomini.initialize();
const save = parser.parseText(buffer, { encoding: "windows1252" });
const player = save.player;
const prestige = save.countries[player].prestige;
```

It is 40x faster to declare upfront what you want to extract from the save file.

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

Couple of important changes:

- The encoding of byte data must be supplied so that the parser knows how to decode strings like "Jåhkåmåhkke"
- The parser is implemented in web assembly and so the runtime environment is restricted to Node 12+ and >90% of browsers
- The parser must be initialized before use. This is a one time cost that is automatically reused on future invocations.

And breaking changes:

```
color = rgb { 100 200 150 }
```

is now parsed to

```js
out = {
    color: { rgb: [100, 200, 150] },
}
```

Same with `hsv`. This change has been done as the object / array header (`rgb` / `hsv`) can be arbitrary and new games introduce new headers. So in order to be more future proof, this change was made.

## v0.2.12 - June 17th 2020

- Fix parsing to support members that have numeric keys and empty values (eg: 'unit={ 2={ } 14={ } }')

## v0.2.11 - December 17th 2019

- Add typescript types

## v0.2.10 - August 29th 2019

- Allow escaped quotes in string fields

## v0.2.9 - June 17th 2019

- Support additional object operators.


```
has_level >= 2
```

The output is 

```js
{'has_level': { 'GREATER_THAN_EQUAL': 2 }}
```

## v0.2.8 - January 13th 2019

- Allow parsing of dashed identifiers

## v0.2.7 - May 28th 2016

- Fix keys for rgb colors

## v0.2.6 - May 28th 2016

- Handle Stellaris variables
- Handle Stellaris colors

## v0.2.5 - May 17th 2016

Add compatibility with Stellaris (#1)

## v0.2.1 - June 1st 2015

Remove extraneous packaged files that (#1)

## v0.2.0 - Feb 7th 2015

A near complete rewrite with [Jison](http://zaach.github.io/jison/) that
ditches the handwritten stream based approach taken previously for an all in
one parser generator. While I believe this sacrifices performance, it makes up
with it in accuracy. I couldn't test the two implementations because parser
generator one was the only one that could parse all the files given.

## v0.1.3 - Feb 2nd 2015

- Added `toDate` to the API
- Implemented parsing of dates that contain hour information

## v0.1.2 - Feb 1st 2015

- Implemented simplified `parse` API
- Implemented `toArray` to force properties to be an array
- Dates are now stored as dates in object and not ISO 8601 strings

## v0.1.1 - Jan 31st 2015

- Removed dependency on lodash
