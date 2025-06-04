const { series, src, dest } = require('gulp');
const fs = require('fs');
const clean = require('gulp-clean');
const eslint = require('gulp-eslint');
const licenser = require('gulp-licenser');
const requirejsOptimize = require('gulp-requirejs-optimize');
const license = fs.readFileSync('./src/banner.txt', 'utf8');

function cleanOutput() {
  return src(['dist/*', 'coverage/*'], {read: false})
    .pipe(clean());
}

function lint() {
  return src('./src/**/*.js')
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
}

function scripts() {
  return src('./src/cdg.js', { sourcemaps: true })
    .pipe(sourcemaps.init())
    .pipe(requirejsOptimize())
    .pipe(licenser(license))
    .pipe(dest('dist', { sourcemaps: '.' }))
}

exports.cleanOutput = series(cleanOutput);
exports.lint = series(lint);
exports.default = series(cleanOutput, scripts);
