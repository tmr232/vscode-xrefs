import * as vscode from "vscode";


export interface UpdatingFile {
    readonly content: string;

    start(onUpdate:()=>void): Promise<void>;

    stop(): void;
}

export class StreamingFile implements UpdatingFile {
    stream: AsyncGenerator<string, void, unknown>;
    private readonly chunks: string[] = [];

    constructor(
        stream: AsyncGenerator<string, void, unknown>,
    ) {
        this.stream = stream;
    }

    async start(onUpdate:()=>void) {
        for await (const chunk of this.stream) {
            this.chunks.push(chunk);
            onUpdate();
        }
    }

    stop() {
        this.stream.return();
    }

    get content() {
        return this.chunks.join("\n");
    }
}

export class VirtualFileProvider
    implements vscode.TextDocumentContentProvider, vscode.Disposable {
    scheme: string;
    private contentMap: Map<string, UpdatingFile> = new Map();
    private index = 0;
    private emitter = new vscode.EventEmitter<vscode.Uri>();

    readonly onDidChange = this.emitter.event;

    constructor(scheme: string) {
        this.scheme = scheme;
    }

    addContent(updatingFile: UpdatingFile): vscode.Uri {
        const uri = vscode.Uri.parse(`${this.scheme}:${this.index++}.code-search`);
        this.contentMap.set(uri.toString(), updatingFile);
        updatingFile.start(() =>
            this.emitter.fire(uri)
        );
        return uri;
    }

    removeContent(uri: vscode.Uri) {
        this.contentMap.get(uri.toString())?.stop();
        this.contentMap.delete(uri.toString());
    }

    provideTextDocumentContent(uri: vscode.Uri): vscode.ProviderResult<string> {
        return this.contentMap.get(uri.toString())?.content;
    }

    dispose() {
        for (const streamingFile of this.contentMap.values()) {
            streamingFile.stop();
        }
    }
}