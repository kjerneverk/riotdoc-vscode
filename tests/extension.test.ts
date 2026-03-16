import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => {
    class EventEmitter<T> {
        event = (_listener: T) => ({ dispose: () => {} });
        fire = () => {};
    }
    class TreeItem {
        label: string;
        collapsibleState: number;
        description?: string;
        iconPath?: unknown;
        contextValue?: string;
        command?: unknown;
        constructor(label: string, collapsibleState: number) {
            this.label = label;
            this.collapsibleState = collapsibleState;
        }
    }
    class ThemeIcon {
        id: string;
        constructor(id: string) { this.id = id; }
    }
    return {
        TreeItem,
        TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
        EventEmitter,
        ThemeIcon,
        window: {
            registerTreeDataProvider: vi.fn(),
            createStatusBarItem: vi.fn(() => ({
                show: vi.fn(),
                hide: vi.fn(),
                dispose: vi.fn(),
            })),
        },
        workspace: {
            workspaceFolders: [],
            createFileSystemWatcher: vi.fn(() => ({
                onDidCreate: vi.fn(),
                onDidChange: vi.fn(),
                onDidDelete: vi.fn(),
                dispose: vi.fn(),
            })),
        },
        commands: {
            registerCommand: vi.fn(),
        },
        StatusBarAlignment: { Left: 1, Right: 2 },
        Uri: { file: (f: string) => ({ fsPath: f, scheme: 'file' }) },
    };
});

describe('riotdoc-vscode', () => {
    it('should export activate and deactivate', async () => {
        const ext = await import('../src/extension');
        expect(ext.activate).toBeDefined();
        expect(ext.deactivate).toBeDefined();
    });
});
