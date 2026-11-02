import { defineConfig } from "tsup";

/**
 * One self-contained module per format. Orderly DEX Creator can load
 * marketplace plugins at runtime by importing `dist/index.mjs` through an
 * import map that only provides `react`, `react/jsx-runtime` and the shared
 * `@orderly.network/*` packages — so everything else (the Swapper SDK) is
 * bundled in, and no code-split chunks are emitted.
 */
export default defineConfig((options) => ({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  target: "es2020",
  splitting: false,
  sourcemap: true,
  treeshake: true,
  clean: !options.watch,
  dts: true,
  tsconfig: "tsconfig.json",
  external: ["react", "react-dom", /^react\//, /^@orderly\.network\//],
  // The stylesheet is built first (build:css) and bundled as a string, which
  // the plugin injects at runtime (src/styles.ts).
  loader: { ".css": "text" },
  noExternal: ["@swapper-finance/deposit-sdk"],
  esbuildOptions(esOptions) {
    if (!options.watch) {
      // Keep console.warn / console.error — integrators need them to debug.
      esOptions.pure = ["console.log", "console.debug"];
      esOptions.drop = ["debugger"];
    }
  },
}));
