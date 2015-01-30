var util = require('util');
var Transform = require('stream').Transform

util.inherits(Header, Transform);

function Header(options) {
    if (!(this instanceof Header))
    	return new Header(options);

    Transform.call(this, options);
    this.header = options.header;
    this.first = true;
}

Header.prototype._transform = function(data, encoding, cb) {
	if (this.first === true) {
		var header = data.toString('utf8', 0, this.header.length);
		var payload = data.slice(this.header.length);
		this.first = false;
		if (header !== this.header) {
			cb(new Error("Expected " + this.header + " but received " + header),
				payload);
			return;
		}
		cb(null, payload);
	}
	else {
		cb(null, data);
	}
};

module.exports = Header;
