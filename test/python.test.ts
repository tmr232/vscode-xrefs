import path from "node:path";
import { expect, test } from "vitest";
import { Language, type Node, Parser, type Tree } from "web-tree-sitter";
import { isImport, isRead, isWrite } from "../src/classifier.ts";
import type { XrefType } from "../src/references.js";

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

const testCases: { code: string; xrefType: XrefType }[] = [
  { code: "a = 2", xrefType: "write" },
  { code: "b = a", xrefType: "read" },
  { code: "x = a = 3", xrefType: "write" },
  { code: "a.x = 2", xrefType: "write" },
  { code: "s[a] = 3", xrefType: "read" },
  { code: "a, b = l", xrefType: "write" },
  { code: "x.a = 1", xrefType: "write" },
  { code: "x[2].a = 1", xrefType: "write" },
  { code: "a[1] = 2", xrefType: "write" },
  { code: "f(a)", xrefType: "read" },
  { code: "import a", xrefType: "import" },
  { code: "import x.a", xrefType: "import" },
  { code: "import a.x", xrefType: "import" },
  { code: "if (a := 2): pass", xrefType: "write" },
  { code: "if (x := a): pass", xrefType: "read" },
];

test.each(testCases)(
  "$xrefType-xref for a in ($code)",
  ({ code, xrefType }) => {
    const { node } = parseSample(code, "a");
    const w = isWrite(node);
    const r = isRead(node);
    const i = isImport(node);
    expect([w, r, i].filter(Boolean).length).toStrictEqual(1);

    switch (xrefType) {
      case "read":
        expect(r).toEqual(true);
        break;
      case "write":
        expect(w).toEqual(true);
        break;
      case "import":
        expect(i).toEqual(true);
        break;
    }
  },
);
