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
    // We want to inline our wasm bundle as base64. Not needing browser users
    // to fetch an additional asset is a boon as there's less room for errors
    wasm({ maxFileSize: 10000000 }),
    typescript({ outDir: `dist/${fmt}` }),
    {
      name: "copy-pkg",
      generateBundle() {
        // Remove the `import` bundler directive that wasm-bindgen spits out as webpack
        // doesn't understand that directive yet
        const data = fs.readFileSync(path.resolve(`src/pkg/jomini_js.js`), 'utf8');
        fs.writeFileSync(path.resolve(`src/pkg/jomini_js.js`), data.replace('import.meta.url', 'input'));

        // copy the typescript definitions that wasm-bindgen creates into the
        // distribution so that downstream users can benefit from documentation
        // on the rust code
        fs.mkdirSync(path.resolve(`dist/${fmt}/pkg`), { recursive: true });
        fs.copyFileSync(
          path.resolve("./src/pkg/jomini_js.d.ts"),
          path.resolve(`dist/${fmt}/pkg/jomini_js.d.ts`)
        );
      },
    },
  ],
});

export default [rolls("umd"), rolls("cjs"), rolls("es")];
