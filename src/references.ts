import vscode from "vscode";

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