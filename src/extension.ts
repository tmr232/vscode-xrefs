import * as vscode from "vscode";
import { init as initParsers } from "./parser.js";
import { type XrefOptions, XrefsFile } from "./references.js";
import { VirtualFileProvider } from "./virtualFileProvider.js";

function buildXrefsCommand(
  fileProvider: VirtualFileProvider,
  options?: XrefOptions,
) {
  return async (editor: vscode.TextEditor) => {
    const uri = fileProvider.addContent(
      new XrefsFile(
        vscode.commands.executeCommand<vscode.Location[]>(
          "vscode.executeReferenceProvider",
          editor.document.uri,
          editor.selection.active,
        ),
        options,
      ),
    );

    await vscode.window.showTextDocument(uri, {
      viewColumn: (editor.viewColumn ?? 0) + 1,
    });
  };
}

export function activate(context: vscode.ExtensionContext) {
  return (async () => {
    await initParsers(context);

    const fileProvider = new VirtualFileProvider("xrefs-result");
    context.subscriptions.push(fileProvider);
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

    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(
        "xrefs.findAllXrefs",
        buildXrefsCommand(fileProvider),
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(
        "xrefs.findWriteXrefs",
        buildXrefsCommand(fileProvider, { onlyType: "write" }),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(
        "xrefs.findReadXrefs",
        buildXrefsCommand(fileProvider, { onlyType: "read" }),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(
        "xrefs.findImportXrefs",
        buildXrefsCommand(fileProvider, { onlyType: "import" }),
      ),
    );
  })();
}
