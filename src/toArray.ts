/**
 * Mutates a container by drilling down to a property and ensuring it is an array.
 * This function is useful when dealing with documents where a single occurence of
 * a field can be mistaken for a scalar value instead of an array. This function
 * ensures that all properties that need to be arrays are arrays.
 * 
 * @param obj The array or object to mutate
 * @param path The path to a field to ensure it is an array
 */
export function toArray(obj: any, path: string) {
  const splits = path.split(".");
  if (splits.length == 1) {
    // If the object has the specified field and it isn't already an
    // array. Make it a one element array
    if (
      !Array.isArray(obj[path]) &&
      Object.prototype.hasOwnProperty.call(obj, path)
    ) {
      obj[path] = [obj[path]];
    }
  } else if (Object.prototype.hasOwnProperty.call(obj, splits[0])) {
    // If the property is an array, make sure to apply this function to
    // all of the subsequent items
    if (Array.isArray(obj[splits[0]])) {
      const arr = obj[splits[0]];
      for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] === "object") {
          toArray(arr[i], path.substring(splits[0].length + 1));
        }
      }
    } else if (typeof obj[splits[0]] === "object") {
      toArray(obj[splits[0]], path.substring(splits[0].length + 1));
    }
  }
}
