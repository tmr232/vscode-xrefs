import path from "node:path";
import { expect, test } from "vitest";
import { Language, type Node, Parser, type Tree } from "web-tree-sitter";
async function loadParser(): Promise<Parser> {
  // await Parser.init();
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

function isWrite(target: Node): boolean {
  if (target.type !== "identifier") {
    throw new Error("Target node must be an identifier!");
  }
  let node = target;
  let parent = node.parent;
  for (; parent; node = parent, parent = node.parent) {
    switch (parent.type) {
      case "assignment": {
        if (parent.childForFieldName("left")?.id === node.id) {
          return true;
        }
        break;
      }
      case "attribute": {
        if (parent.childForFieldName("object")?.id === node.id) {
          return false;
        }
        break;
      }
      case "subscript": {
        if (parent.childForFieldName("subscript")?.id === node.id) {
          return false;
        }
        break;
      }
    }
  }
  return false;
}

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
