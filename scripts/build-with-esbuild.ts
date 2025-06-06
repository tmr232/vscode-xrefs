import esbuild from "esbuild";
import config from "./esbuild.config.ts";

esbuild.build(config).catch(() => process.exit(1));
