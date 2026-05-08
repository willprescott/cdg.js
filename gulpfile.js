const { series, src } = require("gulp");
const fs = require("fs");
const clean = require("gulp-clean");
const eslint = require("gulp-eslint-new");
const esbuild = require("esbuild");
const license = fs.readFileSync("./src/banner.txt", "utf8");

function cleanOutput() {
  return src(["dist/*"], { read: false }).pipe(clean());
}

function lint() {
  return src("./src/**/*.js")
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
}

async function scripts() {
  await esbuild.build({
    entryPoints: ["./src/cdg.js"],
    bundle: true,
    minify: true,
    format: "esm",
    outfile: "./dist/cdg.js",
    banner: { js: license },
    sourcemap: true,
  });
}

exports.cleanOutput = series(cleanOutput);
exports.lint = series(lint);
exports.default = series(cleanOutput, scripts);
