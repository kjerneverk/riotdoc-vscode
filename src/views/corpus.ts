import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { parse } from "yaml";

class CorpusItem extends vscode.TreeItem {
    constructor(
        public readonly corpusPath: string,
        public readonly pattern: string,
        public readonly corpusLabel: string | undefined,
        public readonly entryCount: number | undefined,
    ) {
        super(corpusLabel ?? path.basename(corpusPath), vscode.TreeItemCollapsibleState.None);
        const countSuffix = entryCount !== undefined ? ` (${entryCount} entries)` : "";
        this.description = `${pattern}${countSuffix}`;
        this.tooltip = `Path: ${corpusPath}\nPattern: ${pattern}${countSuffix}`;
        this.iconPath = new vscode.ThemeIcon("library");
        this.contextValue = "corpusPointer";

        if (fs.existsSync(corpusPath)) {
            this.command = {
                command: "revealFileInOS",
                title: "Reveal",
                arguments: [vscode.Uri.file(corpusPath)],
            };
        }
    }
}

export class CorpusProvider implements vscode.TreeDataProvider<CorpusItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<CorpusItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: CorpusItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<CorpusItem[]> {
        const projectDir = await findFirstProjectDir();
        if (!projectDir) {
            return [];
        }

        try {
            const raw = fs.readFileSync(path.join(projectDir, "riotdoc.yaml"), "utf-8");
            const config = parse(raw);
            if (!config?.corpus || !Array.isArray(config.corpus)) {
                return [];
            }

            return config.corpus.map((pointer: {
                path: string;
                pattern?: string;
                label?: string;
            }) => {
                const resolved = path.resolve(projectDir, pointer.path);
                const entryCount = loadEntryCount(projectDir, resolved);
                return new CorpusItem(
                    resolved,
                    pointer.pattern ?? "**/*.md",
                    pointer.label,
                    entryCount,
                );
            });
        } catch {
            return [];
        }
    }
}

function loadEntryCount(projectDir: string, _corpusPath: string): number | undefined {
    const indexPath = path.join(projectDir, ".riotdoc", "cache", "corpus-index.json");
    if (!fs.existsSync(indexPath)) {
        return undefined;
    }
    try {
        const raw = fs.readFileSync(indexPath, "utf-8");
        const index = JSON.parse(raw);
        if (typeof index.entryCount === "number") {
            return index.entryCount;
        }
    } catch {
        // ignore
    }
    return undefined;
}

async function findFirstProjectDir(): Promise<string | undefined> {
    const files = await vscode.workspace.findFiles("**/riotdoc.yaml", "**/node_modules/**", 1);
    return files.length > 0 ? path.dirname(files[0].fsPath) : undefined;
}
