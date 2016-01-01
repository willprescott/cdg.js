var gulp = require('gulp'),
    path = require('path'),
    jshint = require('gulp-jshint'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    concat = require('gulp-concat'),
    del = require('del');

gulp.task('clean', function() {
    return del(['dist/*']);
});

gulp.task('jshint', function() {
    return gulp.src('./src/**/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
});

gulp.task('scripts', function() {
    return gulp.src('./src/**/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(concat('cdg.js'))
        .pipe(gulp.dest('dist'))
        .pipe(rename({suffix: '.min'}))
        .pipe(uglify())
        .pipe(gulp.dest('dist'))
});

gulp.task('watch', function() {
    gulp.watch('src/**/*.js', ['scripts']);
});

gulp.task('default', ['clean'], function() {
    gulp.start('scripts');
});