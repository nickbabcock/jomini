var util = require('util');
var Transform = require('stream').Transform
util.inherits(Para, Transform);


function Para(options) {
    if (!(this instanceof Para))
        return new Para(options);

    Transform.call(this, options);
    this._inBody = false;
    this._sawFirstCr = false;
    this._rawHeader = [];
    this.header = null;
}

Para.prototype._transform = function(chunk, enc, cb) {
    this.push('{');
    this.push(chunk);
    cb();
}

Para.prototype._flush = function(cb) {
    this.push('}');
    cb();
}

module.exports = Para;

