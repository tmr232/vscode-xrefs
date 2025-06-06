import path from "node:path";
import { expect, test } from "vitest";
import { Language, type Node, Parser, type Tree } from "web-tree-sitter";
import { isWrite } from "../src/classifier.ts";

async function loadParser(): Promise<Parser> {
  await Parser.init();
  const wasmPath = path.join(
    process.cwd(),
    "./parsers/tree-sitter-python.wasm",
  );
  const language = await Language.load(wasmPath);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

const parser = await loadParser();

function parseSample(code: string, needle: string): { tree: Tree; node: Node } {
  const tree = parser.parse(code);
  if (!tree) {
    throw new Error("Failed parsing code.");
  }
  const index = code.indexOf(needle);
  if (index === -1) {
    throw new Error("Needle not found in code.");
  }
  const node = tree.rootNode.descendantForIndex(index);
  if (!node) {
    throw new Error("No matching node found.");
  }

  return { tree, node };
}

test("Basic Python Parsing", async () => {
  const tree = parser.parse("a = 3");
  expect(tree).toBeTruthy();
});

test("Find variable in sample", async () => {
  const { node } = parseSample("a = 2", "a");
  expect(node.type).toEqual("identifier");
});

test.each([
  ["a = 2", true],
  ["b = a", false],
  ["x = a = 3", true],
  ["a.x = 2", false],
  ["s[a] = 3", false],
  ["a, b = l", true],
  ["x.a = 1", true],
  ["x[2].a = 1", true],
  ["a[1] = 2", true],
  ["f(a)", false],
])("is a written to in %s ?", (code, expected) => {
  const { node } = parseSample(code, "a");
  expect(isWrite(node)).toEqual(expected);
});

// test.each([
//   ["a = 2", false],
//   ["b = a", true],
//   ["x = a = 3", false],
//   ["a.x = 2", false],
//   ["s[a] = 3", true],
//   ["a, b = l", false],
//   ["x.a = 1", false],
//   ["x[2].a = 1", false],
//   ["a[1] = 2", false],
//   ["f(a)", true],
//     ["a()", true],
//     ["a.b", true],
//     ["a", true],
//     ["a[1]", true],
// ])("is a read from in %s ?", (code, expected) => {
//   const { node } = parseSample(code, "a");
//   expect(isRead(node)).toEqual(expected);
// });
