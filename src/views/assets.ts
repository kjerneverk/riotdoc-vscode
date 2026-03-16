import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { parse } from "yaml";

const TYPE_ICONS: Record<string, string> = {
    image: "file-media",
    diagram: "type-hierarchy",
    chart: "graph",
    video: "device-camera-video",
    audio: "unmute",
    other: "file",
};

class AssetItem extends vscode.TreeItem {
    constructor(
        public readonly assetId: string,
        public readonly filename: string,
        public readonly assetType: string,
        public readonly assetDescription: string | undefined,
        public readonly filePath: string | undefined,
    ) {
        super(filename, vscode.TreeItemCollapsibleState.None);
        this.description = assetType;
        this.tooltip = assetDescription ?? `${assetId} (${assetType})`;
        this.iconPath = new vscode.ThemeIcon(TYPE_ICONS[assetType] ?? "file");
        this.contextValue = "riotdocAsset";

        if (filePath && fs.existsSync(filePath)) {
            this.command = {
                command: "vscode.open",
                title: "Open",
                arguments: [vscode.Uri.file(filePath)],
            };
        }
    }
}

export class AssetsProvider implements vscode.TreeDataProvider<AssetItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<AssetItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: AssetItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<AssetItem[]> {
        const projectDir = await findFirstProjectDir();
        if (!projectDir) {
            return [];
        }

        const manifestPath = path.join(projectDir, "assets", "manifest.yaml");
        if (!fs.existsSync(manifestPath)) {
            return [];
        }

        try {
            const raw = fs.readFileSync(manifestPath, "utf-8");
            const manifest = parse(raw);
            if (!manifest?.assets || !Array.isArray(manifest.assets)) {
                return [];
            }

            return manifest.assets.map((asset: {
                id: string;
                filename: string;
                type: string;
                description?: string;
            }) => {
                const filePath = path.join(projectDir, "assets", "images", asset.filename);
                return new AssetItem(
                    asset.id,
                    asset.filename,
                    asset.type ?? "other",
                    asset.description,
                    fs.existsSync(filePath) ? filePath : undefined,
                );
            });
        } catch {
            return [];
        }
    }
}

async function findFirstProjectDir(): Promise<string | undefined> {
    const files = await vscode.workspace.findFiles("**/riotdoc.yaml", "**/node_modules/**", 1);
    return files.length > 0 ? path.dirname(files[0].fsPath) : undefined;
}
