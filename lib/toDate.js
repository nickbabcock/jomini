// Parses the given string into a Date object. If the string is not a valid
// date, then undefined is returned.
function toDate(str) {
  if (!str) {
    return str;
  }

  // dates look like yyyy.mm.dd
  var parts = str.split('.');
  if (parts.length < 3) {
    return undefined;
  }

  // Make sure the date is only composed of numbers
  parts.map(function(val) { return +val; });
  if (parts.some(isNaN)) {
    return undefined;
  }

  // Subtract one from month because the range is from 0 to 11.
  if (parts.length === 4) {
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3]));
  }
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

module.exports = toDate;
