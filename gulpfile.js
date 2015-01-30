var gulp = require('gulp');
var jscs = require('gulp-jscs');
var mocha = require('gulp-mocha');

gulp.task('test', function() {
    return gulp.src(['test/*js']).pipe(jscs({
        preset: 'google',
        requireCamelCaseOrUpperCaseIdentifiers: 'ignoreProperties'
    })).pipe(mocha());
});

gulp.task('main', ['test'], function() {
    return gulp.src(['lib/*js']).pipe(jscs({
        preset: 'google' 
    }));
});

gulp.task('default', ['main']);
