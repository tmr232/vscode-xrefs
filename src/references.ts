import * as vscode from "vscode";
import {getParser} from "./parser.js";
import {isWrite} from "./classifier.js";

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
                results.push({uri, locations: locs});
            }
            uri = loc.uri;
            locs = [];
        }
        locs.push(loc);
    }
    if (uri && locs.length > 0) {
        results.push({uri, locations: locs});
    }
    return results;
}

export type XrefType = "read"|"write";
export type XrefOptions = {onlyType?: XrefType};


export async function* renderReferences(
    references: Thenable<vscode.Location[]>, options?: XrefOptions,
): AsyncGenerator<string, void, unknown> {
    const refs = await references;

    const refGroups = groupByUri(refs);

    yield `Found ${refs.length} xrefs in ${refGroups.length} files.\n`;

    for (const refGroup of refGroups) {
        yield renderReferenceGroup(refGroup, options);
    }
}

async function renderReferenceGroup(refGroup: ReferenceGroup, options?:XrefOptions): Promise<string> {
    const doc = await vscode.workspace.openTextDocument(refGroup.uri);
    const lines = [];
    const refs:vscode.Location[] = refGroup.locations.toSorted((a, b) =>
        a.range.start.compareTo(b.range.start),
    );
    const path = refGroup.uri.fsPath;

    const parser = getParser();
    const tree = parser.parse(doc.getText());
    if (!tree) {
        throw new Error("Could not parse document");
    }
    for (const ref of refs) {
        const targetNode = tree.rootNode.descendantForPosition({row:ref.range.start.line, column:ref.range.start.character})
        if (!targetNode) {
            throw new Error("Could not find target node");
        }
        console.log(isWrite(targetNode))
    }
    const isRefWrite = (ref:vscode.Location) :boolean => {
        const targetNode = tree.rootNode.descendantForPosition({row:ref.range.start.line, column:ref.range.start.character})
        if (!targetNode) {
            throw new Error("Could not find target node");
        }
        return isWrite(targetNode);
    }
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
    const filteredRefs = refs.filter(isRefWrite)
    for (const ref of filteredRefs.slice(1)) {
        const space_before = Math.max(0, ref.range.start.line - LINES_BEFORE - 1);
        resultLines[space_before] = {
            type: "spacer",
            line: space_before,
            text: "",
        };
    }
    for (const ref of filteredRefs) {
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
    for (const ref of filteredRefs) {
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