import * as vscode from "vscode";

const LINES_BEFORE = 2;
const LINES_AFTER = 2;

function groupByUri(
  locations: vscode.Location[],
): { uri: vscode.Uri; locations: vscode.Location[] }[] {
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

class VirtualFileProvider implements vscode.TextDocumentContentProvider {
  scheme: string;
  private contentMap: Map<string, string> = new Map();
  private index = 0;

  constructor(scheme: string) {
    this.scheme = scheme;
  }

  addContent(content: string): vscode.Uri {
    const uri = vscode.Uri.parse(`${this.scheme}:${this.index++}.code-search`);
    this.contentMap.set(uri.toString(), content);
    return uri;
  }
  removeContent(uri: vscode.Uri) {
    this.contentMap.delete(uri.toString());
  }
  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contentMap.get(uri.toString()) ?? "Missing content!";
  }
}

export function activate(context: vscode.ExtensionContext) {
  const fileProvider = new VirtualFileProvider("xrefs-result");
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      fileProvider.scheme,
      fileProvider,
    ),
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      fileProvider.removeContent(document.uri);
    }),
  );
  // register command that crafts an uri with the `references` scheme,
  // open the dynamic document, and shows it in the next editor
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "xrefs.findAllXrefs",
      async (editor) => {
        const references: vscode.Location[] =
          await vscode.commands.executeCommand(
            "vscode.executeReferenceProvider",
            editor.document.uri,
            editor.selection.active,
          );

        const content = renderReferences(references, editor);
        const uri = fileProvider.addContent(content);

        await vscode.window.showTextDocument(uri, {
          viewColumn: (editor.viewColumn ?? 0) + 1,
        });
      },
    ),
  );
}
function renderReferences(
  references: vscode.Location[],
  editor: vscode.TextEditor,
) {
  const lines = [];
  for (const refGroup of groupByUri(references)) {
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
    for (const ref of refs) {
      const space_before = Math.max(0, ref.range.start.line - LINES_BEFORE - 1);
      resultLines[space_before] = {
        type: "spacer",
        line: space_before,
        text: "",
      };
    }
    for (const ref of refs) {
      const before = Math.max(0, ref.range.start.line - LINES_BEFORE);
      const after = Math.min(
        editor.document.lineCount,
        ref.range.end.line + LINES_AFTER + 1,
      );
      for (let line = before; line < after; ++line) {
        resultLines[line] = {
          type: "context",
          line,
          text: editor.document.lineAt(line).text,
        };
      }

      maxLine = Math.max(maxLine, after);
    }
    for (const ref of refs) {
      const line = ref.range.start.line;
      resultLines[line] = {
        type: "reference",
        line,
        text: editor.document.lineAt(line).text,
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
          lines.push(`  ${pad(res.line + 1)}:  ${res.text}`);
      }
    }
    lines.push("");
  }

  const content = lines.join("\n");
  return content;
}
