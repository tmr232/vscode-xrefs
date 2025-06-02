import * as vscode from "vscode";
import {Language, Parser} from "web-tree-sitter";
import {VirtualFileProvider} from "./virtualFileProvider.js";
import {renderReferences} from "./references.js";

async function loadParser(context: vscode.ExtensionContext) {
  await Parser.init(
    {
      locateFile() {
        return vscode.Uri.joinPath(context.extensionUri, "./parsers/tree-sitter.wasm").fsPath
      }
    }
  );
  return new Parser();
}

export function activate(context: vscode.ExtensionContext) {
  return (async () => {
    const parser = await loadParser(context);
    const language = await Language.load(vscode.Uri.joinPath(context.extensionUri, "./parsers/tree-sitter-python.wasm").fsPath);
    parser.setLanguage(language);
    console.log(parser.parse("a = 1"));

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
            renderReferences(
              vscode.commands.executeCommand<vscode.Location[]>(
                "vscode.executeReferenceProvider",
                editor.document.uri,
                editor.selection.active,
              ),
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

