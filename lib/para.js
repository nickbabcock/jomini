var util = require('util');
var Writable = require('stream').Writable;
var _ = require('lodash');

util.inherits(Para, Writable);

function Para(options) {
  if (!(this instanceof Para)) {
    return new Para(options);
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
Para._untyped = function(c) {
  return !(c === eq || c === rcurl || c === lcurl || c === hash ||
    c === comma || c === semicolon);
};

// Advances the stream through all whitespace and comments
Para.prototype._trimmer = function() {
  var retry = false;
  do {
    while (this._read() && Para._isspace(this.current)) {
    }

    retry = false;
    if (Para._untyped(this.current)) {
      this._unpeek();
    } else if (this.current === hash) {
      while (this._read() && this.current !== carriage) {
      }
      retry = true;
    }
  } while (retry);
};

// Returns whether the given byte is a white space character
Para._isspace = function(c) {
  return c === space || c === tab || c === newline || c === carriage;
};

Para.prototype._read = function() {
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
Para.prototype._unpeek = function() {
  this.eoc = false;
  if (this.bufPos === 0 && this.prevBuf) {
    this.bufPos = this.prevBuf.length - 1;
    this.readFirst = true;
  } else {
    this.bufPos--;
  }
};

// Returns the numerical value of the string if it is a number else undefined
Para._number = function(str) {
  var result = +str;
  if (!isNaN(result)) {
    return result;
  }
};

Para._date = function(str) {
  if (!str) {
    return str;
  }

  var parts = str.split('.');
  if (parts.length < 3) {
    return undefined;
  }

  parts.map(function(val) { return +val; });
  if (parts.some(isNaN)) {
    return undefined;
  }

  // Subtract one from month because the range is from 0 to 11.
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).toISOString();
};

Para.prototype._sliceIdentifier = function() {
  if (this.eoc === true) {
    return undefined;
  }

  this._trimmer();

  var pos = 0;
  if (this.current === quote) {
    this._read();
    while (this._read() && this.current !== quote) {
      this.tok[pos++] = this.current;
    }

    // We have read the quote, so we want to end the new string one before
    this._read();
  } else {
    while (this._read() && Para._untyped(this.current) &&
        !Para._isspace(this.current)) {
      this.tok[pos++] = this.current;
    }

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

Para.prototype._list = function() {
  while (this._read() && (Para._isspace(this.current) || this.current === eq)) {
  }

  var pos = this.bufPos;

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

Para.prototype._obj = function() {
  while (this._read() && (Para._isspace(this.current) || this.current === eq)) {
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

  while (this._read() &&
    (Para._untyped(this.current) || Para._isspace(this.current))) {
  }

  this.readFirst = pos > this.bufPos;
  this.bufPos = pos - 1;

  if (this.eoc === true && this.current !== eq &&
    Para._untyped(this.current)) {
    return undefined;
  } else {
    this.eoc = false;
  }

  // We hit '=', so we know we are parsing an object! And that is cool and
  // all that we are in an object, but make sure we rewind ourselves to the
  // start of the first property.
  if (this.current === eq) {
    this.nest.push(this.obj);
    this.obj = {};
    this.bufPos++;
    return true;
  }

  return false;
};

Para.prototype._identify = function(value) {
  var val = Para._date(value);
  if (val) {
    return val;
  }

  val = Para._number(value);
  if (val !== undefined) {
    return val;
  }

  return value;
};

Para._lcd = function(arr) {
  var i = 0;
  if (arr.length > 0 && _.isObject(arr[0])) {
    return;
  }

  dates = _.map(arr, function(val) { return Para._date(val); });
  if (_.every(dates, _.identity)) {
    for (; i < arr.length; i++) {
      arr[i] = Para._date(arr[i]);
    }
  }

  nums = _.map(arr, function(val) { return Para._number(val); });
  if (_.every(nums, function(val) { return val !== undefined; })) {
    for (; i < arr.length; i++) {
      arr[i] = Para._number(arr[i]);
    }
  }
};

Para.prototype._parseList = function() {
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
  if (value === undefined) {
    if (this.current === lcurl) {
      Para._lcd(this.obj);
      this.obj = this.nest.pop();
      return false;
    }
    return true;
  }

  this.obj.push(value);

  while (this._read() && Para._isspace(this.current)) {
  }

  if (this.eoc === true && !this.isEnding) {
    return true;
  }

  // We probably read too far so backup by one if the current character is
  // something we probably want to be looking at.
  if (Para._untyped(this.current)) {
    this._unpeek();
  }

  if (this.current === lcurl) {
    Para._lcd(this.obj);
    this.obj = this.nest.pop();
    return false;
  }
};

Para.prototype._parseObj = function() {
  var identifier = this._sliceIdentifier();
  var isObj = this._obj();
  if (isObj === undefined) {
    this.bufPos = this.realBufPos;
    this.eoc = false;
    return true;
  } else if (isObj === true) {
    this.nest[this.nest.length - 1][identifier] = this.obj;
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

  if (this.obj.hasOwnProperty(identifier)) {
    // Since the object has the key, we need to check if the value is an array
    // or is single valued. If the property is already an array, push the new
    // value to the end. Else the property is still single valued, then create
    // a list with the two elements
    if (util.isArray(this.obj[identifier])) {
      this.obj[identifier].push(value);
    } else {
      this.obj[identifier] = [this.obj[identifier], value];
    }
  } else {
    // New property so we just shove it into the object
    this.obj[identifier] = value;
  }

  this._trimmer();

  if (this.current === lcurl) {
    this.obj = this.nest.pop();
  }

  return false;
};

Para.prototype._parse = function(cb) {
  while (this.eoc === false) {
    // If the object we are adding to is an array. We keep on processing
    // elements and adding it to the end of the array. Else if we are
    // dealing with an object, continue processing key value pairs
    var cutoffed = util.isArray(this.obj) ? this._parseList() :
        this._parseObj();
    if (cutoffed) {
      cb();

      // Because this could be the last chunk before the "finish" event
      if (this.buf.prevBuf) {
        this.readFirst = true;
      }
      return;
    } else if (this.current === lcurl) {
      var redo = true;
      while (redo) {
        redo = false;
        while (this._read() && Para._isspace(this.current)) {
        }

        if (this.current === lcurl && this.nest.length > 0) {
          redo = true;
          if (util.isArray(this.obj)) {
            Para._lcd(this.obj);
            this.obj = this.nest.pop();
          } else {
            this.obj = this.nest.pop();
          }
        } else if (this.current !== lcurl) {
          this._unpeek();
        }
      }
    }
  }
  cb();
};

Para.prototype._write = function(chunk, enc, cb) {
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

module.exports = Para;
