import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { parse } from "yaml";

export interface ProjectInfo {
    name: string;
    type: string;
    description?: string;
    configUri: vscode.Uri;
    projectDir: string;
}

export class ProjectItem extends vscode.TreeItem {
    constructor(public readonly project: ProjectInfo) {
        super(project.name, vscode.TreeItemCollapsibleState.None);
        this.description = project.type;
        this.tooltip = project.description ?? project.name;
        this.contextValue = "riotdocProject";
        this.iconPath = new vscode.ThemeIcon("book");
        this.command = {
            command: "vscode.open",
            title: "Open Config",
            arguments: [project.configUri],
        };
    }
}

export class ProjectsProvider implements vscode.TreeDataProvider<ProjectItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ProjectItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private cachedProjects: ProjectItem[] | undefined;

    refresh(): void {
        this.cachedProjects = undefined;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: ProjectItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<ProjectItem[]> {
        if (this.cachedProjects) {
            return this.cachedProjects;
        }
        const items: ProjectItem[] = [];
        const files = await vscode.workspace.findFiles("**/riotdoc.yaml", "**/node_modules/**");
        for (const file of files) {
            try {
                const raw = fs.readFileSync(file.fsPath, "utf-8");
                const config = parse(raw);
                if (config && typeof config.name === "string") {
                    items.push(new ProjectItem({
                        name: config.name,
                        type: config.type ?? "general",
                        description: config.description,
                        configUri: file,
                        projectDir: path.dirname(file.fsPath),
                    }));
                }
            } catch {
                // skip malformed configs
            }
        }
        this.cachedProjects = items;
        return items;
    }
}
