var Header = require('../').Header;
var stream = require('stream');
var expect = require('chai').expect

describe('Header', function() {
  it('detect expected header', function(done) {
    var s = new stream.Readable();
    s.push('EU4txtblah');
    s.push(null);
    var head = new Header({header: 'EU4txt'});
    s.pipe(head);
    head.on('data', function(data) {
      expect(data.toString()).to.equal('blah');
      done();
    });
  });

  it('error on unexpected header', function(done) {
    var s = new stream.Readable();
    s.push('EU4binblah');
    s.push(null);
    var head = new Header({header: 'EU4txt'});
    s.pipe(head);
    head.on('error', function(err) {
      expect(err.message).to.equal('Expected EU4txt but received EU4bin');
      done();
    });
  });

  it('should write through subsequent data', function(done) {
    var head = new Header({header: 'EU4txt'});
    head.write('EU4txt\nblah', 'utf8', function() {
      head.write('blue', 'utf8', function() {
        var actual = head.read().toString();
        expect(actual).to.equal('\nblahblue');
        done();
      });
    });
  });
});
