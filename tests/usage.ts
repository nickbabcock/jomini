// File for testing typescript usage
import { Jomini, toArray } from "..";

(async function () {
  const jomini = await Jomini.initialize();
  let actual = jomini.parseText("a=b");
  if (actual["a"] != "b") {
    throw new Error("unexpected result");
  }

  actual = jomini.parseText("a=b", { encoding: "utf8" });
  actual = jomini.parseText("a=b", { encoding: "windows1252" });
  actual = jomini.parseText("a=b", {}, (cb) => cb.at("/a"));
  toArray(actual, "a");

  const _out = jomini.write((writer) => {
    writer.write_integer(1);
    writer.write_integer(2);
    writer.write_unquoted("foo");
    writer.write_quoted("bar");
  });

  Jomini.resetModule();

  const wasmModule = null as unknown as WebAssembly.Module;
  await Jomini.initialize({
    wasm: wasmModule,
  });
})();
