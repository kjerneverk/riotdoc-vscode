import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { parse } from "yaml";

type VoiceLayer = "voice" | "tone" | "rhetoric";

const LAYER_DESCRIPTIONS: Record<VoiceLayer, string> = {
    voice: "Author perspective and posture",
    tone: "Tonal registers and triggers",
    rhetoric: "Reproducible rhetorical structures",
};

class VoiceLayerItem extends vscode.TreeItem {
    constructor(
        public readonly layer: VoiceLayer,
        public readonly filePath: string | undefined,
        public readonly source: string,
    ) {
        super(layer, vscode.TreeItemCollapsibleState.None);
        this.description = source;
        this.tooltip = `${LAYER_DESCRIPTIONS[layer]}\nSource: ${source}`;
        this.iconPath = new vscode.ThemeIcon(
            layer === "voice" ? "megaphone" :
            layer === "tone" ? "paintcan" : "symbol-structure",
        );

        if (filePath && fs.existsSync(filePath)) {
            this.command = {
                command: "vscode.open",
                title: "Open",
                arguments: [vscode.Uri.file(filePath)],
            };
        }
    }
}

export class VoiceProvider implements vscode.TreeDataProvider<VoiceLayerItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<VoiceLayerItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: VoiceLayerItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<VoiceLayerItem[]> {
        const projectDir = await findFirstProjectDir();
        if (!projectDir) {
            return [];
        }

        const layers: VoiceLayer[] = ["voice", "tone", "rhetoric"];
        const items: VoiceLayerItem[] = [];

        const voiceDir = path.join(projectDir, "voice");
        const sharedProfile = await getSharedProfileDir(projectDir);

        for (const layer of layers) {
            const projectFile = path.join(voiceDir, `${layer}.md`);
            const sharedFile = sharedProfile ? path.join(sharedProfile, `${layer}.md`) : undefined;

            if (fs.existsSync(projectFile)) {
                items.push(new VoiceLayerItem(layer, projectFile, "project"));
            } else if (sharedFile && fs.existsSync(sharedFile)) {
                items.push(new VoiceLayerItem(layer, sharedFile, "shared"));
            } else {
                items.push(new VoiceLayerItem(layer, undefined, "not configured"));
            }
        }

        return items;
    }
}

async function findFirstProjectDir(): Promise<string | undefined> {
    const files = await vscode.workspace.findFiles("**/riotdoc.yaml", "**/node_modules/**", 1);
    return files.length > 0 ? path.dirname(files[0].fsPath) : undefined;
}

async function getSharedProfileDir(projectDir: string): Promise<string | undefined> {
    try {
        const raw = fs.readFileSync(path.join(projectDir, "riotdoc.yaml"), "utf-8");
        const config = parse(raw);
        if (config?.voice?.profile) {
            const resolved = path.resolve(projectDir, config.voice.profile);
            return fs.existsSync(resolved) ? resolved : undefined;
        }
    } catch {
        // ignore parse errors
    }
    return undefined;
}
