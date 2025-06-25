import type { BuildOptions } from "esbuild";
import { copy } from "esbuild-plugin-copy";
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
    ".wasm": "file",
  },
  logLevel: "info",
  plugins: [
    copy({
      resolveFrom: "cwd",
      assets: [
        {
          from: ["./parsers/tree-sitter.wasm"],
          to: ["./dist/"],
        },
        {
          from: ["./parsers/tree-sitter-python.wasm"],
          to: ["./dist/parsers/"],
        },
      ],
    }),
  ],
};

export default config;
