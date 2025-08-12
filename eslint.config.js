const js = require("@eslint/js");
const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
  {
    files: ["./src/**/*.js"],
    plugins: {
      js,
    },
    extends: ["js/recommended"],
    rules: {},
  },
]);
