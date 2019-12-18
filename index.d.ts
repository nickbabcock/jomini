export function parse<T extends {}>(data: string): T;

/**
 * Given an object and an arbitrarily nested path to access in the object,
 * make the last property an array if it is not already
 *
 * @param object an object returned by parse, the object itself is modified
 * @param path the path to a property in dot-notation ('army.unit')
 */
export function toArray(object: object, path: string): void;

export function toDate(string: string | undefined): Date | undefined;
export function toBool(string: string): boolean | undefined;
