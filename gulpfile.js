var gulp = require('gulp');
var jscs = require('gulp-jscs');
var mocha = require('gulp-mocha');
var jshint = require('gulp-jshint');
var istanbul = require('gulp-istanbul');

gulp.task('test', function(cb) {
  gulp.src('lib/*.js')
    .pipe(istanbul())
    .pipe(istanbul.hookRequire())
    .on('finish', function() {
      gulp.src(['test/*js'])
      .pipe(jscs({
        preset: 'google',
        requireCamelCaseOrUpperCaseIdentifiers: 'ignoreProperties'
      }))
      .pipe(mocha())
      .pipe(istanbul.writeReports())
      .on('end', cb);
    });
});

gulp.task('lint', function() {
  return gulp.src(['lib/**/*.js', 'test/**/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'))
    .pipe(jshint.reporter('fail'));
});

gulp.task('main', ['test', 'lint'], function() {
  return gulp.src(['lib/*js']).pipe(jscs({
    preset: 'google'
  }));
});

gulp.task('default', ['main']);
