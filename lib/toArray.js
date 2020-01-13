var util = require('util');

// Given an object and an arbitrarily nested path to access in the object,
// make the last property an array if it is not already
function toArray(obj, path) {
  var splits = path.split('.');
  if (splits.length == 1) {
    // If the object has the specified field and it isn't already an
    // array. Make it a one element array
    if (!util.isArray(obj[path]) && obj.hasOwnProperty(path)) {
      obj[path] = [obj[path]];
    }
  } else if (obj.hasOwnProperty(splits[0])) {
    // If the property is an array, make sure to apply this function to
    // all of the subsequent items
    if (util.isArray(obj[splits[0]])) {
      var arr = obj[splits[0]];
      for (var i = 0; i < arr.length; i++) {
        if (typeof arr[i] === 'object') {
          toArray(arr[i], path.substring(splits[0].length + 1));
        }
      }
    } else if (typeof obj[splits[0]] === 'object') {
      toArray(obj[splits[0]], path.substring(splits[0].length + 1));
    }
  }
}

module.exports = toArray;
