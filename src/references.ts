import * as vscode from "vscode";
import { getXrefType } from "./classifier.js";
import { getParser } from "./parser.js";
import type { UpdatingFile } from "./virtualFileProvider.js";

const LINES_BEFORE = 2;
const LINES_AFTER = 2;
type ReferenceGroup = { uri: vscode.Uri; locations: vscode.Location[] };

function groupByUri(locations: vscode.Location[]): ReferenceGroup[] {
  const results: { uri: vscode.Uri; locations: vscode.Location[] }[] = [];
  let uri: vscode.Uri | undefined;
  let locs: vscode.Location[] = [];
  for (const loc of locations) {
    if (!uri || uri.toString() !== loc.uri.toString()) {
      if (uri && locs.length > 0) {
        results.push({ uri, locations: locs });
      }
      uri = loc.uri;
      locs = [];
    }
    locs.push(loc);
  }
  if (uri && locs.length > 0) {
    results.push({ uri, locations: locs });
  }
  return results;
}

export type XrefType = "read" | "write" | "import";
export type XrefOptions = { onlyType?: XrefType };

export async function* renderReferences(
  references: Thenable<vscode.Location[]>,
): AsyncGenerator<string, void, unknown> {
  const refs = await references;

  const refGroups = groupByUri(refs);

  yield `Found ${refs.length} xrefs in ${refGroups.length} files.\n`;

  for (const refGroup of refGroups) {
    yield renderReferenceGroup(refGroup);
  }
}

async function renderReferenceGroup(refGroup: ReferenceGroup): Promise<string> {
  const doc = await vscode.workspace.openTextDocument(refGroup.uri);
  const lines = [];
  const refs = refGroup.locations.toSorted((a, b) =>
    a.range.start.compareTo(b.range.start),
  );
  const path = refGroup.uri.fsPath;

  lines.push(`${path}:`);
  type LineType = "context" | "reference" | "spacer";
  /*
    For some odd reason, `new Map()` does not work in the remote extension host.
    So instead of maps, we're using objects.
    It's terrible, but it works.
    */
  const resultLines: Record<
    number,
    { type: LineType; line: number; text: string }
  > = Object.create(null);
  let maxLine = 0;
  for (const ref of refs.slice(1)) {
    const space_before = Math.max(0, ref.range.start.line - LINES_BEFORE - 1);
    resultLines[space_before] = {
      type: "spacer",
      line: space_before,
      text: "",
    };
  }
  for (const ref of refs) {
    const before = Math.max(0, ref.range.start.line - LINES_BEFORE);
    const after = Math.min(doc.lineCount, ref.range.end.line + LINES_AFTER + 1);
    for (let line = before; line < after; ++line) {
      console.log("Line", line);
      resultLines[line] = {
        type: "context",
        line,
        text: doc.lineAt(line).text,
      };
    }

    maxLine = Math.max(maxLine, after);
  }
  for (const ref of refs) {
    const line = ref.range.start.line;
    console.log("Line:", line);
    resultLines[line] = {
      type: "reference",
      line,
      text: doc.lineAt(line).text,
    };
  }

  const padCount = `${maxLine + 1}`.length;
  const pad = (n: number) => `${n}`.padStart(padCount);
  for (const res of Object.values(resultLines).toSorted(
    (a, b) => a.line - b.line,
  )) {
    switch (res.type) {
      case "spacer":
        lines.push("");
        break;
      case "context":
        lines.push(`  ${pad(res.line + 1)}  ${res.text}`);
        break;
      case "reference":
        lines.push(`  ${pad(res.line + 1)}: ${res.text}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

async function filterReferences(
  refGroup: ReferenceGroup,
  options?: XrefOptions,
): Promise<ReferenceGroup> {
  if (!options?.onlyType) {
    return { uri: refGroup.uri, locations: [...refGroup.locations] };
  }
  const doc = await vscode.workspace.openTextDocument(refGroup.uri);
  const parser = getParser();
  const tree = parser.parse(doc.getText());
  if (!tree) {
    throw new Error("Could not parse document");
  }
  const filter = (ref: vscode.Location): boolean => {
    const targetNode = tree.rootNode.descendantForPosition({
      row: ref.range.start.line,
      column: ref.range.start.character,
    });
    if (!targetNode) {
      throw new Error("Could not find target node");
    }

    return getXrefType(targetNode) === options.onlyType;
  };

  return { uri: refGroup.uri, locations: refGroup.locations.filter(filter) };
}

export class XrefsFile implements UpdatingFile {
  readonly references: Thenable<vscode.Location[]>;
  readonly options: XrefOptions | undefined;
  private headerStats?: { files: number; refs: number } = undefined;
  private done = false;
  private shouldStop = false;
  private renderedRefs: string[] = [];

  constructor(references: Thenable<vscode.Location[]>, options?: XrefOptions) {
    this.references = references;
    this.options = options;
  }

  async start(onUpdate: () => void): Promise<void> {
    const refs = await this.references;
    const refGroups = groupByUri(refs);

    if (!this.options) {
      this.headerStats = { files: refGroups.length, refs: refs.length };
    } else {
      this.headerStats = { files: 0, refs: 0 };
    }
    onUpdate();

    for (const refGroup of refGroups) {
      if (this.shouldStop) {
        break;
      }
      const filtered = await filterReferences(refGroup, this.options);
      if (filtered.locations.length > 0) {
        this.headerStats.files += 1;
        this.headerStats.refs += filtered.locations.length;
      }
      const renderedGroup = await renderReferenceGroup(filtered);
      this.renderedRefs.push(renderedGroup);
      onUpdate();
    }
    this.done = true;
    onUpdate();
  }

  stop(): void {
    this.shouldStop = true;
  }

  get content(): string {
    if (!this.headerStats) {
      return "";
    }

    const parts: string[] = [];

    const xrefTypeName = (() => {
      if (this.options) {
        return `${this.options.onlyType}-`;
      }
      return "";
    })();

    parts.push(
      `Found ${this.headerStats.refs} ${xrefTypeName}xrefs in ${this.headerStats.files} files.\n`,
    );

    if (!this.done) {
      parts.push("Searching for more...\n");
    }

    parts.push(...this.renderedRefs);

    return parts.join("\n");
  }
}
