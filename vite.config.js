import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    copyPublicDir: true,
    sourcemap: true,
    lib: {
      entry: "src/extension.ts",
      formats: ["cjs", "es"],
      fileName: "extension",
    },
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: "src/extension.ts",
      external: ["vscode"],
      // output: {
      //   entryFileNames: "[name].js",
      //   chunkFileNames: "[name].js",
      //   assetFileNames: "[name].[ext]",
      // },
    },
  },
});
