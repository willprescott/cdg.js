import { defineConfig } from "vite";
import { readFileSync } from "fs";

const banner = readFileSync("./src/banner.txt", "utf8");

export default defineConfig({
  build: {
    lib: {
      entry: "./src/cdg.js",
      fileName: "cdg",
      formats: ["es"],
    },
    sourcemap: true,
    rolldownOptions: {
      output: {
        banner: banner,
      },
    },
  },
});
