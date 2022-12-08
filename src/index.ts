export * from "./index_core.js";
import jomini_wasm from "./pkg/jomini_js_bg.wasm";
import { setWasmInit } from "./jomini.js";

// @ts-ignore
setWasmInit(() => jomini_wasm());
