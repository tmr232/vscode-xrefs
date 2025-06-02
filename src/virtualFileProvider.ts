import * as vscode from "vscode";

class StreamingFile {
    stream: AsyncGenerator<string, void, unknown>;
    onUpdate: () => void;
    private readonly chunks: string[] = [];

    constructor(
        stream: AsyncGenerator<string, void, unknown>,
        onUpdate: () => void,
    ) {
        this.stream = stream;
        this.onUpdate = onUpdate;
    }

    async startStream() {
        for await (const chunk of this.stream) {
            this.chunks.push(chunk);
            this.onUpdate();
        }
    }

    stopStream() {
        this.stream.return();
    }

    get content() {
        return this.chunks.join("\n");
    }
}

export class VirtualFileProvider
    implements vscode.TextDocumentContentProvider, vscode.Disposable {
    scheme: string;
    private contentMap: Map<string, StreamingFile> = new Map();
    private index = 0;
    private emitter = new vscode.EventEmitter<vscode.Uri>();

    readonly onDidChange = this.emitter.event;

    constructor(scheme: string) {
        this.scheme = scheme;
    }

    addContent(contentStream: AsyncGenerator<string>): vscode.Uri {
        const uri = vscode.Uri.parse(`${this.scheme}:${this.index++}.code-search`);
        const streamingFile = new StreamingFile(contentStream, () =>
            this.emitter.fire(uri),
        );
        this.contentMap.set(uri.toString(), streamingFile);
        streamingFile.startStream();
        return uri;
    }

    removeContent(uri: vscode.Uri) {
        this.contentMap.get(uri.toString())?.stopStream();
        this.contentMap.delete(uri.toString());
    }

    provideTextDocumentContent(uri: vscode.Uri): vscode.ProviderResult<string> {
        return this.contentMap.get(uri.toString())?.content;
    }

    dispose() {
        for (const streamingFile of this.contentMap.values()) {
            streamingFile.stopStream();
        }
    }
}