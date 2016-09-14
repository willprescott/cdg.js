var gulp = require('gulp'),
  eslint = require('gulp-eslint'),
  sourcemaps = require('gulp-sourcemaps'),
  licenser = require('gulp-licenser'),
  requirejsOptimize = require('gulp-requirejs-optimize'),
  del = require('del'),
  fs = require('fs');

var license = fs.readFileSync('./src/banner.txt', 'utf8');

gulp.task('clean', function() {
  return del(['dist/*', 'coverage/*']);
});

gulp.task('eslint', function() {
  return gulp.src('./src/**/*.js')
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
});

gulp.task('scripts', function() {
  return gulp.src('./src/cdg.js')
    .pipe(sourcemaps.init())
    .pipe(requirejsOptimize())
    .pipe(licenser(license))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('dist'))
});

gulp.task('default', ['clean'], function() {
  gulp.start('scripts');
});