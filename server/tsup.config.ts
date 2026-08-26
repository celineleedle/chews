import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  outDir: "dist",
  clean: true,
  // shared ships as TS source, so it must be inlined into the bundle
  noExternal: ["@chews/shared"],
});
