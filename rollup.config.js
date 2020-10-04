import { wasm } from "@rollup/plugin-wasm";
import typescript from "@rollup/plugin-typescript";
const path = require("path");
const fs = require("fs");

const rolls = (fmt) => ({
  input: "src/index.ts",
  output: {
    dir: `dist/${fmt}`,
    format: fmt,
    name: "jomini",
  },
  plugins: [
    wasm(),
    typescript({ outDir: `dist/${fmt}` }),
    {
      // We create our own rollup plugin that copies the typescript definitions that 
      // wasm-bindgen creates into the distribution so that downstream users can benefit
      // from documentation on the rust code
      name: "copy-pkg",
      generateBundle() {
        fs.mkdirSync(path.resolve(`dist/${fmt}/pkg`), { recursive: true });
        fs.copyFileSync(
          path.resolve("./src/pkg/jomini_js.d.ts"),
          path.resolve(`dist/${fmt}/pkg/jomini_js.d.ts`)
        );
      },
    },
  ],
});

export default [rolls("cjs"), rolls("es")];
