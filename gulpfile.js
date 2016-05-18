var gulp = require('gulp');
var mocha = require('gulp-mocha');
var istanbul = require('gulp-istanbul');
var jisonCli = require('gulp-jison');

gulp.task('test', ['jison'], function(cb) {
  gulp.src(['lib/*.js', '!lib/jomini.js'])
    .pipe(istanbul())
    .pipe(istanbul.hookRequire())
    .on('finish', function() {
      gulp.src(['test/*js'])
      .pipe(mocha())
      .pipe(istanbul.writeReports())
      .on('end', cb);
    });
});

gulp.task('jison', function() {
  return gulp.src('./lib/*.jison')
    .pipe(jisonCli({ 'module-type': 'commonjs' }))
    .pipe(gulp.dest('./lib/'));
});

gulp.task('default', ['jison', 'test']);
