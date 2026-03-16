import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { stringify } from "yaml";
import type { ProjectsProvider } from "../views/projects";
import type { VoiceProvider } from "../views/voice";
import type { GuidanceProvider } from "../views/guidance";
import type { AssetsProvider } from "../views/assets";
import type { CorpusProvider } from "../views/corpus";

interface Providers {
    projectsProvider: ProjectsProvider;
    voiceProvider: VoiceProvider;
    guidanceProvider: GuidanceProvider;
    assetsProvider: AssetsProvider;
    corpusProvider: CorpusProvider;
}

const DOCUMENT_TYPES = [
    "blog-post", "blog-series", "book", "essay",
    "podcast-script", "work-paper", "technical-doc",
    "newsletter", "general", "custom",
];

export function registerCommands(context: vscode.ExtensionContext, providers: Providers): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("riotdoc.createProject", () => createProject(providers)),
        vscode.commands.registerCommand("riotdoc.showVoice", () => showVoice()),
        vscode.commands.registerCommand("riotdoc.addGuidance", () => addGuidance(providers)),
        vscode.commands.registerCommand("riotdoc.registerAsset", () => registerAsset(providers)),
        vscode.commands.registerCommand("riotdoc.searchCorpus", () => searchCorpus()),
        vscode.commands.registerCommand("riotdoc.assemblePrompt", () => assemblePrompt()),
        vscode.commands.registerCommand("riotdoc.refresh", () => refreshAll(providers)),
    );
}

async function createProject(providers: Providers): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
        vscode.window.showErrorMessage("Open a workspace folder first.");
        return;
    }

    const name = await vscode.window.showInputBox({
        prompt: "Project name",
        placeHolder: "my-document",
    });
    if (!name) return;

    const docType = await vscode.window.showQuickPick(DOCUMENT_TYPES, {
        placeHolder: "Select document type",
    });
    if (!docType) return;

    const description = await vscode.window.showInputBox({
        prompt: "Brief description (optional)",
        placeHolder: "A blog post about...",
    });

    const projectDir = path.join(folders[0].uri.fsPath, name);
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(projectDir, "voice"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "drafts"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "context"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "assets", "images"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "assets", "prompts"), { recursive: true });

    const config: Record<string, unknown> = {
        name,
        type: docType,
    };
    if (description) config.description = description;

    const configPath = path.join(projectDir, "riotdoc.yaml");
    fs.writeFileSync(configPath, stringify(config), "utf-8");

    const doc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(doc);
    providers.projectsProvider.refresh();
}

async function showVoice(): Promise<void> {
    const files = await vscode.workspace.findFiles("**/riotdoc.yaml", "**/node_modules/**", 1);
    if (!files.length) {
        vscode.window.showInformationMessage("No RiotDoc project found in workspace.");
        return;
    }

    const projectDir = path.dirname(files[0].fsPath);
    const layers = ["voice.md", "tone.md", "rhetoric.md"];
    const voiceDir = path.join(projectDir, "voice");

    for (const layer of layers) {
        const filePath = path.join(voiceDir, layer);
        if (fs.existsSync(filePath)) {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc, { preview: false });
        }
    }

    if (!layers.some(l => fs.existsSync(path.join(voiceDir, l)))) {
        vscode.window.showInformationMessage("No voice profile files found. Create voice/voice.md, voice/tone.md, or voice/rhetoric.md.");
    }
}

async function addGuidance(providers: Providers): Promise<void> {
    const files = await vscode.workspace.findFiles("**/riotdoc.yaml", "**/node_modules/**", 1);
    if (!files.length) {
        vscode.window.showInformationMessage("No RiotDoc project found in workspace.");
        return;
    }

    const projectDir = path.dirname(files[0].fsPath);
    const guidancePath = path.join(projectDir, "context", "guidance.yaml");

    const id = await vscode.window.showInputBox({
        prompt: "Guidance source ID",
        placeHolder: "hn-trends",
    });
    if (!id) return;

    const label = await vscode.window.showInputBox({
        prompt: "Human-readable label",
        placeHolder: "Hacker News Trend Analysis",
    });
    if (!label) return;

    const sourceType = await vscode.window.showQuickPick(["file", "directory"], {
        placeHolder: "Is this a file or directory?",
    });
    if (!sourceType) return;

    const selectedUri = sourceType === "file"
        ? await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false })
        : await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true });
    if (!selectedUri?.length) return;

    const newSource = {
        id,
        label,
        type: sourceType,
        path: path.relative(projectDir, selectedUri[0].fsPath),
    };

    let config: { sources: unknown[] };
    if (fs.existsSync(guidancePath)) {
        const { parse: parseYaml } = await import("yaml");
        const raw = fs.readFileSync(guidancePath, "utf-8");
        config = parseYaml(raw) ?? { sources: [] };
        if (!Array.isArray(config.sources)) config.sources = [];
    } else {
        fs.mkdirSync(path.dirname(guidancePath), { recursive: true });
        config = { sources: [] };
    }

    config.sources.push(newSource);
    fs.writeFileSync(guidancePath, stringify(config), "utf-8");

    const doc = await vscode.workspace.openTextDocument(guidancePath);
    await vscode.window.showTextDocument(doc);
    providers.guidanceProvider.refresh();
}

async function registerAsset(providers: Providers): Promise<void> {
    const files = await vscode.workspace.findFiles("**/riotdoc.yaml", "**/node_modules/**", 1);
    if (!files.length) {
        vscode.window.showInformationMessage("No RiotDoc project found in workspace.");
        return;
    }

    const projectDir = path.dirname(files[0].fsPath);
    const manifestPath = path.join(projectDir, "assets", "manifest.yaml");

    const selectedFiles = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: true,
        filters: {
            "Images": ["png", "jpg", "jpeg", "gif", "svg", "webp"],
            "All files": ["*"],
        },
    });
    if (!selectedFiles?.length) return;

    const assetType = await vscode.window.showQuickPick(
        ["image", "diagram", "chart", "video", "audio", "other"],
        { placeHolder: "Asset type" },
    );
    if (!assetType) return;

    let manifest: { assets: unknown[] };
    if (fs.existsSync(manifestPath)) {
        const { parse: parseYaml } = await import("yaml");
        const raw = fs.readFileSync(manifestPath, "utf-8");
        manifest = parseYaml(raw) ?? { assets: [] };
        if (!Array.isArray(manifest.assets)) manifest.assets = [];
    } else {
        fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
        manifest = { assets: [] };
    }

    for (const file of selectedFiles) {
        const filename = path.basename(file.fsPath);
        const id = filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-");
        manifest.assets.push({ id, filename, type: assetType });

        const destDir = path.join(projectDir, "assets", "images");
        const dest = path.join(destDir, filename);
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(destDir, { recursive: true });
            fs.copyFileSync(file.fsPath, dest);
        }
    }

    fs.writeFileSync(manifestPath, stringify(manifest), "utf-8");
    providers.assetsProvider.refresh();
    vscode.window.showInformationMessage(`Registered ${selectedFiles.length} asset(s).`);
}

async function searchCorpus(): Promise<void> {
    const files = await vscode.workspace.findFiles("**/riotdoc.yaml", "**/node_modules/**", 1);
    if (!files.length) {
        vscode.window.showInformationMessage("No RiotDoc project found in workspace.");
        return;
    }

    const projectDir = path.dirname(files[0].fsPath);
    const indexPath = path.join(projectDir, ".riotdoc", "cache", "corpus-index.json");

    if (!fs.existsSync(indexPath)) {
        vscode.window.showInformationMessage("No corpus index found. Run the RiotDoc MCP server to build one.");
        return;
    }

    const raw = fs.readFileSync(indexPath, "utf-8");
    const index = JSON.parse(raw);
    if (!index.entries?.length) {
        vscode.window.showInformationMessage("Corpus index is empty.");
        return;
    }

    const items: vscode.QuickPickItem[] = index.entries.map((entry: { title: string; path: string; wordCount: number }) => ({
        label: entry.title,
        description: `${entry.wordCount} words`,
        detail: entry.path,
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Search corpus entries by title",
        matchOnDescription: true,
        matchOnDetail: true,
    });

    if (selected?.detail) {
        const filePath = path.resolve(projectDir, selected.detail);
        if (fs.existsSync(filePath)) {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
        }
    }
}

async function assemblePrompt(): Promise<void> {
    vscode.window.showInformationMessage(
        "Prompt assembly requires the RiotDoc MCP server. This will be available when HTTP transport is configured.",
    );
}

function refreshAll(providers: Providers): void {
    providers.projectsProvider.refresh();
    providers.voiceProvider.refresh();
    providers.guidanceProvider.refresh();
    providers.assetsProvider.refresh();
    providers.corpusProvider.refresh();
    vscode.window.showInformationMessage("RiotDoc views refreshed.");
}
