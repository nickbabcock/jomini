export * from "./index_core";
import jomini_wasm from "./pkg/jomini_js_bg.wasm";
import { setWasmInit } from "./jomini";

// @ts-ignore
setWasmInit(() => jomini_wasm());
