import * as vscode from "vscode";
import {Language, Parser} from "web-tree-sitter";

const languages:{python?: Language} = {}

export async function init(context:vscode.ExtensionContext) {
    await Parser.init(
        {
            locateFile() {
                return vscode.Uri.joinPath(context.extensionUri, "./parsers/tree-sitter.wasm").fsPath
            }
        }
    );
    const language = await Language.load(vscode.Uri.joinPath(context.extensionUri, "./parsers/tree-sitter-python.wasm").fsPath);
    languages.python = language;

}

export function getParser():Parser {
    const parser = new Parser();
    if (!languages.python) {
        throw new Error("Language not initialized!");
    }
    parser.setLanguage(languages.python);
    return parser;
}