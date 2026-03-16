import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { parse } from "yaml";

class GuidanceItem extends vscode.TreeItem {
    constructor(
        public readonly id: string,
        label: string,
        public readonly sourcePath: string,
        public readonly category: string | undefined,
        public readonly sourceType: "file" | "directory",
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = category ?? sourceType;
        this.tooltip = `${label}\nPath: ${sourcePath}\nType: ${sourceType}`;
        this.iconPath = new vscode.ThemeIcon(
            sourceType === "directory" ? "folder" : "file",
        );
        this.contextValue = "guidanceSource";

        const resolved = path.isAbsolute(sourcePath) ? sourcePath : undefined;
        if (resolved && fs.existsSync(resolved)) {
            this.command = {
                command: sourceType === "directory" ? "revealFileInOS" : "vscode.open",
                title: "Open",
                arguments: [vscode.Uri.file(resolved)],
            };
        }
    }
}

export class GuidanceProvider implements vscode.TreeDataProvider<GuidanceItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<GuidanceItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: GuidanceItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<GuidanceItem[]> {
        const projectDir = await findFirstProjectDir();
        if (!projectDir) {
            return [];
        }

        const guidancePath = path.join(projectDir, "context", "guidance.yaml");
        if (!fs.existsSync(guidancePath)) {
            return [];
        }

        try {
            const raw = fs.readFileSync(guidancePath, "utf-8");
            const config = parse(raw);
            if (!config?.sources || !Array.isArray(config.sources)) {
                return [];
            }

            return config.sources.map((src: {
                id: string;
                label: string;
                path: string;
                category?: string;
                type: "file" | "directory";
            }) => new GuidanceItem(
                src.id,
                src.label,
                path.resolve(projectDir, src.path),
                src.category,
                src.type ?? "file",
            ));
        } catch {
            return [];
        }
    }
}

async function findFirstProjectDir(): Promise<string | undefined> {
    const files = await vscode.workspace.findFiles("**/riotdoc.yaml", "**/node_modules/**", 1);
    return files.length > 0 ? path.dirname(files[0].fsPath) : undefined;
}
