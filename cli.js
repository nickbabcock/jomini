const { readFileSync } = require("fs");
const { Jomini } = require(".");
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.info("expected one argument for the file path");
  process.exit(1);
}

console.time("read file");
const buffer = readFileSync(args[0]);
console.timeLog("read file");

(async function () {
  console.time("initialize jomini");
  const parser = await Jomini.initialize();
  console.timeLog("initialize jomini");

  console.time("initialize jomini2");
  const parser2 = await Jomini.initialize();
  console.timeLog("initialize jomini2");

  console.time("parse text")
  parser.parseText(buffer, { encoding: "windows1252" }, (_) => null);
  console.timeLog("parse text");

  console.time("parse text whole")
  parser.parseText(buffer, { encoding: "windows1252" });
  console.timeLog("parse text whole");

  console.time("parse text at");
  const { player, prestige } = parser.parseText(
    buffer,
    { encoding: "windows1252" },
    (query) => {
      const player = query.at("/player");
      const prestige = query.at(`/countries/${player}/prestige`);
      return { player, prestige };
    }
  );
  console.log(`player: ${player} | prestige: ${prestige}`);
  console.timeLog("parse text at");

  console.time("parse text json");
  const out = parser.parseText(
    buffer,
    { encoding: "windows1252" },
    (query) => query.json(),
  );
  console.timeLog("parse text json");

  console.time("parse json")
  JSON.parse(out);
  console.timeLog("parse json")
})();
