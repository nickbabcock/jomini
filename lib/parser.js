var util = require('util');
var Writable = require('stream').Writable;
var toDate = require('./toDate');
var toBool = require('./toBool');

util.inherits(Parser, Writable);

function Parser(options) {
  if (!(this instanceof Parser)) {
    return new Parser(options);
  }

  Writable.call(this, options);
  this.on('finish', function() {
    this.isEnding = true;
    this._parse(function() { });
  }.bind(this));

  // The current object being population
  this.obj = {};

  // Data structure to monitor the object as we go deeper into the hierarchy.
  // Once the object has been read completely, it is popped off
  this.nest = [];

  // Current byte in the stream
  this.current = '';

  // Buffer used to aggregate characters across chunks
  this.tok = new Buffer(256);
}

var eq = '='.charCodeAt(0);
var rcurl = '{'.charCodeAt(0);
var lcurl = '}'.charCodeAt(0);
var hash = '#'.charCodeAt(0);
var comma = ','.charCodeAt(0);
var semicolon = ';'.charCodeAt(0);
var quote = '"'.charCodeAt(0);
var tab = '\t'.charCodeAt(0);
var space = ' '.charCodeAt(0);
var newline = '\n'.charCodeAt(0);
var carriage = '\r'.charCodeAt(0);

// Returns whether the given byte is untyped. Untyped means it is not a
// delimiter for these types of files. Examples of untyped are alphanumeric
// characters and whitespace
Parser._untyped = function(c) {
  return !(c === eq || c === rcurl || c === lcurl || c === hash ||
    c === comma || c === semicolon);
};

// Advances the stream through all whitespace and comments
Parser.prototype._trimmer = function() {
  var retry = false;
  do {
    while (this._read() && Parser._isspace(this.current)) {
    }

    retry = false;
    if (Parser._untyped(this.current)) {
      this._unpeek();
    } else if (this.current === hash) {
      while (this._read() && this.current !== carriage) {
      }
      retry = true;
    }
  } while (retry);
};

// Returns whether the given byte is a white space character
Parser._isspace = function(c) {
  return c === space || c === tab || c === newline || c === carriage;
};

Parser.prototype._read = function() {
  if (this.eoc === true) {
    return false;
  }

  if (this.readFirst) {
    this.current = this.prevBuf[this.bufPos++];
    if (this.bufPos === this.prevBuf.length) {
      this.readFirst = false;
      this.bufPos = 0;
    }

    return true;
  }

  if (this.bufPos < this.buf.length) {
    this.current = this.buf[this.bufPos++];
    return true;
  }

  this.eoc = true;
  return false;
};

// Moves the stream backwards by one byte. If a previous buffer exists and the
// buffer position is zero, start backing up at the end of the previous buffer.
Parser.prototype._unpeek = function() {
  this.eoc = false;
  if (this.bufPos === 0 && this.prevBuf) {
    this.bufPos = this.prevBuf.length - 1;
    this.readFirst = true;
  } else {
    this.bufPos--;
  }
};

// Returns the numerical value of the string if it is a number else undefined
Parser._number = function(str) {
  var result = +str;
  if (!isNaN(result) && str !== '') {
    return result;
  }
};

// Advances the streams returns the next identifier. The result will be
// undefined if the function didn't get enough room to extract the identifier
Parser.prototype._sliceIdentifier = function() {
  if (this.eoc === true) {
    return undefined;
  }

  this._trimmer();

  var pos = 0;

  // Check for a quote. If we are looking at a quote, then the identifier
  // stretches through all until the end quote is found. This means that the
  // resulting value can contain whitespace! If we don't see a quote then we
  // continue until the chunk ends or a delimiter is found (such as an equals
  // or whitespace)
  if (this.current === quote) {
    this._read();
    while (this._read() && this.current !== quote) {
      this.tok[pos++] = this.current;
    }

    // We have read the quote, so we want to end the new string one before
    this._read();
  } else {
    while (this._read() && Parser._untyped(this.current) &&
        !Parser._isspace(this.current)) {
      this.tok[pos++] = this.current;
    }

    // We read too far if it is not the end of the chunk, so back up
    if (this.eoc === false) {
      this._unpeek();
    }
  }

  if (this.eoc && !this.isEnding) {
    return undefined;
  }

  var result = this.tok.toString('utf8', 0, pos);
  return result;
};

// Reads through the stream and attempts to detect a list. If a list is
// detected, the object that is being parsed changes to a list and the function
// returns true.
Parser.prototype._list = function() {
  while (this._read() &&
    (Parser._isspace(this.current) || this.current === eq)) {
  }

  if (this.current === rcurl) {
    this.nest.push(this.obj);
    this.obj = [];
    this.realBufPos = this.bufPos;
    return true;
  } else {
    this._unpeek();
    return undefined;
  }
};

// Reads through the stream and attemps to detect a list. If a list is
// detected, the object that is being parsed changes to a list and the function
// returns true. If the function knows that the stream doesn't contain an
// object, it returns false. If there isn't enough data to determine, it
// returns undefined.
Parser.prototype._obj = function() {
  while (this._read() &&
    (Parser._isspace(this.current) || this.current === eq)) {
  }

  // If we hit the end of the chunk, well we don't know if we are looking at an
  // object. Else if we aren't looking at a right curly then we aren't looking
  // at an object
  if (this.eoc === true) {
    return undefined;
  } else if (this.current !== rcurl) {
    this._unpeek();
    return false;
  }

  var pos = this.bufPos;
  var foundUntyped = false;

  // Attempt to advance the stream to the next delimiter, we are looking for an
  // equal
  while (this._read() &&
    (Parser._untyped(this.current) || Parser._isspace(this.current))) {
    foundUntyped |= Parser._untyped(this.current) &&
      !Parser._isspace(this.current);
  }

  // We possibly read into the next chunk, so make a note of that as we reset
  // to an earlier position so that we can re-read the identifier
  this.readFirst = pos > this.bufPos;
  this.bufPos = pos - 1;

  if (this.eoc === true && (this.current !== eq && this.current !== lcurl) &&
    Parser._untyped(this.current)) {
    return undefined;
  } else {
    this.eoc = false;
  }

  // We hit '=', so we know we are parsing an object! And that is cool and
  // all that we are in an object, but make sure we rewind ourselves to the
  // start of the first property.
  if (this.current === eq || (this.current === lcurl && !foundUntyped)) {
    this.nest.push(this.obj);
    this.obj = {};
    this.bufPos++;
    if (this.current === lcurl) {
      this.emptyObject = true;
    }
    return true;
  }

  return false;
};

// Convert the string value to the most restrictive type. Return the new value
// in its restrictive type
Parser.prototype._identify = function(value) {
  var val = toBool(value);
  if (val !== undefined) {
    return val;
  }

  val = toDate(value);
  if (val) {
    return val;
  }

  val = Parser._number(value);
  if (val !== undefined) {
    return val;
  }

  return value;
};

// Convert the array to an array of the least common demoninator types. An
// array of strings and ints will be converted to an array of strings.
Parser._lcd = function(arr) {
  var i = 0;

  // If the array is an array of objects. Let's jettison.
  if (arr.length > 0 && typeof arr[0] === 'object') {
    return;
  }

  // Is this an array of bools?
  bools = arr.map(function(val) { return toBool(val); });
  if (bools.every(function(val) { return val !== undefined; })) {
    for (; i < arr.length; i++) {
      arr[i] = toBool(arr[i]);
    }
    return;
  }

  // Is this an array of dates?
  dates = arr.map(function(val) { return toDate(val); });
  if (dates.every(function(val) { return val !== undefined; })) {
    for (; i < arr.length; i++) {
      arr[i] = toDate(arr[i]);
    }
    return;
  }

  // Is this an array of ints?
  var nums = arr.map(function(val) { return Parser._number(val); });
  if (nums.every(function(val) { return val !== undefined; })) {
    for (; i < arr.length; i++) {
      arr[i] = Parser._number(arr[i]);
    }
  }
};

Parser.prototype._parseList = function() {
  // This could be a list of objects so we first check if we are lookgin at an
  // object. We may not have enough buffer space to properly evaluate
  var isObj = this._obj();
  if (isObj === undefined) {
    this.bufPos = this.realBufPos;
    this.eoc = false;
    return true;
  } else if (isObj === true) {
    this.nest[this.nest.length - 1].push(this.obj);
    return this._parseObj();
  }

  var value = this._sliceIdentifier();

  // The end of the list, the list was empty, or we ran out of buffer
  if (value === undefined) {
    if (this.current === lcurl) {
      Parser._lcd(this.obj);
      this.obj = this.nest.pop();
      return false;
    }
    return true;
  }

  this.obj.push(value);

  while (this._read() && Parser._isspace(this.current)) {
  }

  if (this.eoc === true && !this.isEnding) {
    return true;
  }

  // We probably read too far so backup by one if the current character is
  // something we probably want to be looking at.
  if (Parser._untyped(this.current)) {
    this._unpeek();
  }

  // Convert the list to the least common denominator type and pop it from the
  // list as we are done parsing the list
  if (this.current === lcurl) {
    Parser._lcd(this.obj);
    this.obj = this.nest.pop();
    this.realBufPos = this.bufPos;
    return false;
  }
};

Parser._setProp = function(obj, identifier, value) {
  if (obj.hasOwnProperty(identifier)) {
    // Since the object has the key, we need to check if the value is an array
    // or is single valued. If the property is already an array, push the new
    // value to the end. Else the property is still single valued, then create
    // a list with the two elements
    if (util.isArray(obj[identifier])) {
      obj[identifier].push(value);
    } else {
      obj[identifier] = [obj[identifier], value];
    }
  } else {
    // New property so we just shove it into the object
    obj[identifier] = value;
  }
};

Parser.prototype._parseObj = function() {
  var identifier = this._sliceIdentifier();
  var isObj = this._obj();
  if (isObj === undefined) {
    this.bufPos = this.realBufPos;
    this.eoc = false;
    return true;
  } else if (isObj === true) {
    Parser._setProp(this.nest[this.nest.length - 1], identifier, this.obj);
    if (this.emptyObject) {
      this.realBufPos = this.bufPos;
      this.emptyObject = false;
      return false;
    }
    return this._parseObj();
  }

  var isList = this._list();
  if (isList) {
    this.nest[this.nest.length - 1][identifier] = this.obj;
    return this._parseList();
  }

  var value = this._identify(this._sliceIdentifier());
  if (identifier === undefined || value === undefined) {
    this.readFirst = this.realBufPos >= this.bufPos;
    this.bufPos = this.realBufPos;
    this.eoc = false;
    return true;
  } else {
    this.realBufPos = this.bufPos;
  }

  Parser._setProp(this.obj, identifier, value);
  this._trimmer();

  if (this.current === lcurl) {
    this.obj = this.nest.pop();
    this.realBufPos = this.bufPos;
  }

  return false;
};

Parser.prototype._parse = function(cb) {
  while (this.eoc === false) {
    // If the object we are adding to is an array. We keep on processing
    // elements and adding it to the end of the array. Else if we are
    // dealing with an object, continue processing key value pairs
    var cutoffed = util.isArray(this.obj) ? this._parseList() :
        this._parseObj();

    // While parsing, we may have run out of buffer room for parsing. If so we
    // invoke the call back and wait for more data.
    if (cutoffed) {
      cb();

      // Because this could be the last chunk before the "finish" event
      if (this.buf.prevBuf) {
        this.readFirst = true;
      }
      return;
    } else if (this.current === lcurl) {
      // As long as there are left curlies lined up in the buffer, pop them off
      // and finalize them
      var redo = true;
      while (redo) {
        redo = false;
        while (this._read() && Parser._isspace(this.current)) {
        }

        if (this.current === lcurl && this.nest.length > 0) {
          redo = true;
          if (util.isArray(this.obj)) {
            Parser._lcd(this.obj);
          }
          this.obj = this.nest.pop();
        } else if (this.current !== lcurl) {
          this._unpeek();
        }
      }
    }
  }
  cb();
};

Parser.prototype._write = function(chunk, enc, cb) {
  // If there is something in the buffer we squirrel it away as we may need to
  // reference the data in it
  if (this.buf !== undefined) {
    this.prevBuf = this.buf;
    this.readFirst = true;
    this.bufPos = Math.min(this.bufPos, this.buf.length - 1);
  } else {
    this.bufPos = 0;
    this.realBufPos = 0;
  }

  this.eoc = false;
  this.buf = chunk;
  this._parse(cb);
};

module.exports = Parser;
