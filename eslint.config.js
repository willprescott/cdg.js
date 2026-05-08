const js = require("@eslint/js");
const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
  {
    files: ["./src/**/*.js"],
    plugins: {
      js,
    },
    extends: ["js/recommended"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    rules: {},
  },
]);
