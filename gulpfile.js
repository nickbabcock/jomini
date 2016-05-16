var gulp = require('gulp');
var jscs = require('gulp-jscs');
var mocha = require('gulp-mocha');
var jshint = require('gulp-jshint');
var istanbul = require('gulp-istanbul');
var jisonCli = require('gulp-jison');

gulp.task('test', ['jison'], function(cb) {
  gulp.src(['lib/*.js', '!lib/jomini.js'])
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

gulp.task('jison', function() {
  return gulp.src('./lib/*.jison')
    .pipe(jisonCli({ 'module-type': 'commonjs' }))
    .pipe(gulp.dest('./lib/'));
});

gulp.task('lint', function() {
  return gulp.src(['lib/**/*.js', 'test/**/*.js', '!lib/jomini.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'))
    .pipe(jshint.reporter('fail'));
});

gulp.task('main', ['jison', 'test', 'lint'], function() {
  return gulp.src(['lib/*js', '!lib/jomini.js']).pipe(jscs({
    preset: 'google'
  }));
});

gulp.task('default', ['main']);
