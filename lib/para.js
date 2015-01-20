var util = require('util');
var Writable = require('stream').Writable
util.inherits(Para, Writable);


function Para(options) {
    if (!(this instanceof Para))
        return new Para(options);

    Writable.call(this, options);
    this.obj = {};
    this.current = '';
    this.eof = false;
}

var eq = '='.charCodeAt(0),
    rcurl = '{'.charCodeAt(0),
    lcurl = '}'.charCodeAt(0),
    hash = '#'.charCodeAt(0),
    comma = ','.charCodeAt(0),
    semicolon = ';'.charCodeAt(0);

Para._untyped = function(c) {
    return !(c === eq || c === rcurl || c === lcurl || c === hash || c === comma || c === semicolon);
}

Para.prototype._trim = function() {
    while (this._read() && (!Para._untyped(this.current) || Para._isspace(this.current))) {
    }

    // We probably read too far so backup by one if the current character is
    // something we probably want to be looking at.
    if (Para._untyped(this.current)) {
        this.bufPos--;
    }
}

Para._isspace = function(c) {
    return c === ' ' || (c >= '\t' && c <= '\r');
}

Para.prototype._read = function() {
    if (this.bufPos < this.buf.length) {
        this.current = this.buf[this.bufPos++];
        return true;
    }
    
    this.eof = true;
    return false;
}

Para.prototype._sliceIdentifier = function() {
    this._trim();

    var pos = this.bufPos;

    while (this._read() && Para._untyped(this.current)) {
    }

    if (this.eof === false) {
        this.bufPos--;
    }

    var result = this.buf.toString('utf8', pos, this.bufPos);
    return result;
}

Para.prototype._write = function(chunk, enc, cb) {
    this.buf = chunk;
    this.bufPos = 0;
    this.obj[this._sliceIdentifier()] = this._sliceIdentifier();
    cb();
}

module.exports = Para;

