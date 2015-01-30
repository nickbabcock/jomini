var gulp = require('gulp');
var jscs = require('gulp-jscs');
var mocha = require('gulp-mocha');
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

gulp.task('main', ['test'], function() {
    return gulp.src(['lib/*js']).pipe(jscs({
        preset: 'google' 
    }));
});

gulp.task('default', ['main']);
