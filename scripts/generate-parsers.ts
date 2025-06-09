import * as fs from "node:fs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
/**
 * The `generate-parsers` script copies or builds the relevant tree-sitter
 * parsers in to the `./parsers` directory.
 *
 * To add a new parsers, add it's package name to the `parsersToBuild` array.
 * @module
 */
import { $ } from "bun";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

type Location = { package: string; name: string };
function asLocation(entry: string | Location): Location {
  if (isString(entry)) {
    return { package: entry, name: entry };
  }
  return entry;
}

/**
 * The parsers to include
 */
const parsersToBuild: (Location | string)[] = ["tree-sitter-python"];

function locatePrebuiltWasm(location: Location): string {
  return fileURLToPath(
    import.meta.resolve(`${location.package}/${location.name}.wasm`),
  );
}

function hasPrebuiltWasm(location: Location): boolean {
  try {
    locatePrebuiltWasm(location);
  } catch {
    return false;
  }
  return true;
}

await mkdir("./parsers");

for (const location of parsersToBuild.map(asLocation)) {
  const targetWasmPath = `./parsers/${location.name}.wasm`;
  if (await Bun.file(targetWasmPath).exists()) {
    console.log(`${location.name}: .wasm found, skipping copy.`);
  } else if (hasPrebuiltWasm(location)) {
    console.log(`${location.name}: copying .wasm`);
    fs.copyFileSync(locatePrebuiltWasm(location), targetWasmPath);
  } else {
    console.log(`${location.name}: building .wasm`);
    await $`bun x --bun tree-sitter build --wasm -o ${targetWasmPath} ./node_modules/${location.package}/`;
  }

  await $`git add ${targetWasmPath}`;
}

const treeSitterPath = "./parsers/tree-sitter.wasm";
if (!(await Bun.file(treeSitterPath).exists())) {
  const treeSitter = Bun.file(
    "./node_modules/web-tree-sitter/tree-sitter.wasm",
  );
  await Bun.write(treeSitterPath, treeSitter);
  await $`git add ${treeSitterPath}`;
}
