import init, { parse_text, Query as WasmQuery } from "./pkg/jomini_js";
import jomini_wasm from "./pkg/jomini_js_bg.wasm";

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
    options?: Partial<ParseOptions>,
    cb?: (arg0: Query) => T
  ) {
    if (typeof data === "string") {
      var inp = encoder.encode(data);
      options = { ...options, ...{ encoding: "utf8" } };
    } else {
      var inp = data;
    }

    const query = new Query(parse_text(inp, options?.encoding ?? "utf8"));

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

/**
 * Tweaks the knobs used in JSON generation
 */
export type JsonOptions = {
  /**
   * If the JSON should be pretty-printed. Defaults to false
   */
  pretty: boolean;

  /**
   * Determines how duplicate keys are disambiguated from arrays. The default of
   * "none" means that there is no disambiguation and that duplicate keys will
   * be aggregated into an array and appear similar to other arrays. "keys" will
   * write duplicate keys back into the JSON but it is debateable whether duplicate
   * keys is considered valid JSON. "typed" is an overly verbose format that translates
   * objects into arrays of key value tuples -- arrays are also transformed in this
   * process to explicitly list their type as `array`
   */
  disambiguate: "none" | "keys" | "typed";
};

export class Query {
  constructor(private query: WasmQuery) {}

  /** Convert the entire document into an object */
  root(): Object {
    return this.query.root();
  }

  /**
   * Narrow down the document to just the specified property
   *
   * @param pointer the JSON pointer-esque string to the desired value
   * @returns object, array, or value identified by the query
   */
  at(pointer: string): any {
    return this.query.at(pointer);
  }

  /** Convert the entire document into a JSON string */
  json(options?: Partial<JsonOptions>): string {
    return this.query.json(
      options?.pretty || false,
      options?.disambiguate || "none"
    );
  }

  /** Internal, do not use */
  free() {
    this.query.free();
  }
}
