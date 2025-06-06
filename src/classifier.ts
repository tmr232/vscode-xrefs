import type { Node } from "web-tree-sitter";

export function isWrite(target: Node): boolean {
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
