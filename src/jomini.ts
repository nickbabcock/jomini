import init, { parse_text, Query } from "./pkg/jomini_js";
// @ts-ignore
import jomini_wasm from "./pkg/jomini_js_bg.wasm";


// export type JQuery = Query;

/**
 * Supported encodings: UTF8 and Windows1252
 */
export type Encoding = "utf8" | "windows1252";

/**
 * Tweaks the knobs used in parsing
 */
export type ParseOptions = {
  /**
   * The encoding used to transform bytes to strings
   */
  encoding: Encoding;
};

const encoder = new TextEncoder();
let initialized = false;
export class Jomini {
  private constructor() {}

  /**
   * Parses plain text data into javascript values
   * 
   * @param data The data to parse, can either be raw bytes or a string. If given a string, the
   * string will be encoded as utf-8. Else if given bytes, they are assumed to be utf-8 unless the
   * windows1252 is passed as the encoding.
   * @param options Controls the encoding of the data. If not configured, assumes utf-8
   * @param cb The callback to extract a subset of the parsed document. Since creating JS objects
   * is where 95-99% of the performance is lost, one can achieve a great speedup by requesting only
   * the bits needed. If a callback is not provided, then the entire parsed document is returned.
   */
  public parseText<T>(
    data: Uint8Array | string,
    options: undefined | Partial<ParseOptions>,
    cb: undefined | ((arg0: Query) => T)
  ) {
    if (typeof data === "string") {
      var inp = encoder.encode(data);
      options = { ...options, ...{ encoding: "utf8" } };
    } else {
      var inp = data;
    }

    const query = parse_text(inp, options?.encoding ?? "utf8");
    if (cb === undefined) {
      const val = query.root();
      query.free();
      return val;
    } else {
      const val = cb(query);
      query.free();
      return val;
    }
  }

  /**
   * Initializes a jomini parser. There is a one time global setup fee (sub 30ms), but subsequent
   * requests to initialize will be instantaneous, so it's not imperative to reuse the same parser.
   */
  public static initialize = async () => {
    if (!initialized) {
      //@ts-ignore
      await init(jomini_wasm());
      initialized = true;
    }

    return new Jomini();
  };
}
