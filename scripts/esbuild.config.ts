import type { BuildOptions } from "esbuild";

const config: BuildOptions = {
  entryPoints: ["./src/extension.ts"],
  bundle: true,
  platform: "node",
  target: "node16",
  outdir: "./dist",
  outbase: "./src",
  packages: "bundle",
  outExtension: {
    ".js": ".js",
  },
  format: "esm",
  external: ["vscode"],
  loader: {
    ".ts": "ts",
    ".js": "js",
  },
  logLevel: "info",
  sourcemap: "inline",
};

export default config;
