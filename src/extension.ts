import * as vscode from "vscode";
import { ProjectsProvider } from "./views/projects";
import { VoiceProvider } from "./views/voice";
import { GuidanceProvider } from "./views/guidance";
import { AssetsProvider } from "./views/assets";
import { CorpusProvider } from "./views/corpus";
import { registerCommands } from "./commands/index";

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    const projectsProvider = new ProjectsProvider();
    const voiceProvider = new VoiceProvider();
    const guidanceProvider = new GuidanceProvider();
    const assetsProvider = new AssetsProvider();
    const corpusProvider = new CorpusProvider();

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider("riotdoc.projects", projectsProvider),
        vscode.window.registerTreeDataProvider("riotdoc.voice", voiceProvider),
        vscode.window.registerTreeDataProvider("riotdoc.guidance", guidanceProvider),
        vscode.window.registerTreeDataProvider("riotdoc.assets", assetsProvider),
        vscode.window.registerTreeDataProvider("riotdoc.corpus", corpusProvider),
    );

    const providers = { projectsProvider, voiceProvider, guidanceProvider, assetsProvider, corpusProvider };
    registerCommands(context, providers);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    statusBarItem.command = "riotdoc.createProject";
    context.subscriptions.push(statusBarItem);

    updateStatusBar(projectsProvider);
    projectsProvider.onDidChangeTreeData(() => updateStatusBar(projectsProvider));

    const watcher = vscode.workspace.createFileSystemWatcher("**/riotdoc.yaml");
    context.subscriptions.push(
        watcher,
        watcher.onDidCreate(() => refreshAll(providers)),
        watcher.onDidChange(() => refreshAll(providers)),
        watcher.onDidDelete(() => refreshAll(providers)),
    );
}

function refreshAll(providers: {
    projectsProvider: ProjectsProvider;
    voiceProvider: VoiceProvider;
    guidanceProvider: GuidanceProvider;
    assetsProvider: AssetsProvider;
    corpusProvider: CorpusProvider;
}) {
    providers.projectsProvider.refresh();
    providers.voiceProvider.refresh();
    providers.guidanceProvider.refresh();
    providers.assetsProvider.refresh();
    providers.corpusProvider.refresh();
}

async function updateStatusBar(projectsProvider: ProjectsProvider) {
    const projects = await projectsProvider.getChildren();
    if (projects.length > 0) {
        const first = projects[0];
        statusBarItem.text = `$(book) ${first.label}`;
        statusBarItem.tooltip = "RiotDoc project";
        statusBarItem.show();
    } else {
        statusBarItem.hide();
    }
}

export function deactivate() {
    statusBarItem?.dispose();
}
