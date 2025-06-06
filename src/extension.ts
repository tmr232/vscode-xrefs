import * as vscode from "vscode";
import {StreamingFile, VirtualFileProvider} from "./virtualFileProvider.js";
import {renderReferences, XrefsFile} from "./references.js";
import {init as initParsers} from "./parser.js"

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
    // register command that crafts an uri with the `references` scheme,
    // open the dynamic document, and shows it in the next editor
    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(
        "xrefs.findAllXrefs",
        async (editor) => {
          const uri = fileProvider.addContent(
            new XrefsFile(
              vscode.commands.executeCommand<vscode.Location[]>(
                "vscode.executeReferenceProvider",
                editor.document.uri,
                editor.selection.active,
              ),
                {onlyType:"write"}
            ),
          );

          await vscode.window.showTextDocument(uri, {
            viewColumn: (editor.viewColumn ?? 0) + 1,
          });
        },
      ),
    );
  })();
}

