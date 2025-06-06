import type { Node } from "web-tree-sitter";
import type { XrefType } from "./references.js";

const IMPORT_NODES = new Set(["import_statement", "import_from_statement"]);

function hasMatchingAncestor(
  node: Node,
  predicate: (node: Node) => boolean,
): boolean {
  for (let current: Node | null = node; current; current = current.parent) {
    if (predicate(current)) {
      return true;
    }
  }
  return false;
}

export function isWrite(target: Node): boolean {
  if (target.type !== "identifier") {
    throw new Error("Target node must be an identifier!");
  }

  if (isInsideImport(target)) {
    return false;
  }

  let node = target;
  let parent = node.parent;
  for (; parent; node = parent, parent = node.parent) {
    switch (parent.type) {
      case "named_expression": {
        // Walrus operator
        return parent.childForFieldName("name")?.id === node.id;
      }
      case "assignment": {
        return parent.childForFieldName("left")?.id === node.id;
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

function isInsideImport(node: Node): boolean {
  return hasMatchingAncestor(node, (ancestor) =>
    IMPORT_NODES.has(ancestor.type),
  );
}

export function isRead(target: Node): boolean {
  if (target.type !== "identifier") {
    throw new Error("Target node must be an identifier!");
  }

  if (isInsideImport(target)) {
    return false;
  }

  let node = target;
  let parent = node.parent;
  for (; parent; node = parent, parent = node.parent) {
    switch (parent.type) {
      case "assignment": {
        return parent.childForFieldName("right")?.id === node.id;
      }
      case "named_expression": {
        // Walrus operator
        return parent.childForFieldName("value")?.id === node.id;
      }
      case "subscript": {
        if (parent.childForFieldName("subscript")?.id === node.id) {
          return true;
        }
        break;
      }
    }
  }
  return true;
}

export function isImport(target: Node): boolean {
  return isInsideImport(target);
}

export function getXrefType(target: Node): XrefType {
  if (isWrite(target)) {
    return "write";
  }
  if (isRead(target)) {
    return "read";
  }
  if (isImport(target)) {
    return "import";
  }
  throw new Error("Xref should always be read, write, or import.");
}
