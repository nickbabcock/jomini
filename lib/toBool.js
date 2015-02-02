function toBool(str) {
  if (str === 'yes' || str === 'no') {
    return str === 'yes';
  }
}

module.exports = toBool;
