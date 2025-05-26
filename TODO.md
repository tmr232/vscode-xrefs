We need to use a virtual file provider so that VSCode doesn't constantly ask us to save the files we create.

```typescript
import * as vscode from 'vscode';

class VirtualFileProvider implements vscode.TextDocumentContentProvider {
    private content = `def hello_world():
    print("Hello from Python!")
    return [1, 2, 3, 4, 5]

if __name__ == "__main__":
    hello_world()`;

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.content;
    }
}

function createVirtualPythonFile() {
    // Register provider
    const provider = new VirtualFileProvider();
    vscode.workspace.registerTextDocumentContentProvider('virtual', provider);
    
    // Create URI with .py extension - VSCode will auto-detect Python
    const uri = vscode.Uri.parse('virtual:example.py');
    vscode.window.showTextDocument(uri);
}
```

This means that the lookup logic moves to the provider.
Alternatively, we can keep the logic where it is, and directly inject into the provider.
We generate a unique identifier, and use the mapping.
We can use `vscode.workspace.onDidCloseTextDocument()` to detect when the file closed, and free the data.
This is different from the original extension in that we don't need to invent our own document
format, but use the `.code-search` one.

See https://claude.ai/chat/6301efbd-ec24-4e30-acc7-f15561c69cfa 

```typescript
import * as vscode from 'vscode';

class UpdatableVirtualFileProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private _content = `def hello_world():
    print("Hello from Python!")
    return [1, 2, 3, 4, 5]

if __name__ == "__main__":
    hello_world()`;

    // This event tells VSCode when content has changed
    readonly onDidChange = this._onDidChange.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this._content;
    }

    // Method to update content
    updateContent(newContent: string, uri: vscode.Uri) {
        this._content = newContent;
        // Fire the event to notify VSCode of the change
        this._onDidChange.fire(uri);
    }

    // Dispose method to clean up
    dispose() {
        this._onDidChange.dispose();
    }
}

// Usage example:
let provider: UpdatableVirtualFileProvider;

function createUpdatableVirtualFile() {
    provider = new UpdatableVirtualFileProvider();
    
    // Register the provider
    const registration = vscode.workspace.registerTextDocumentContentProvider('updatable', provider);
    
    // Create and show the virtual file
    const uri = vscode.Uri.parse('updatable:example.py');
    vscode.window.showTextDocument(uri);
    
    // Store registration for cleanup
    return registration;
}

// Function to update the content
function updateVirtualFileContent() {
    if (provider) {
        const newContent = `def updated_function():
    print("Content has been updated!")
    print("Current time:", datetime.now())
    return "Updated successfully"

import datetime
updated_function()`;
        
        const uri = vscode.Uri.parse('updatable:example.py');
        provider.updateContent(newContent, uri);
    }
}
```