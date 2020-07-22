import * as vscode from 'vscode';
import * as Path from 'path';
import { VcprojFileTreeDataProvider, VcprojViewItem } from './vcprojTreeDataProvider';

export class VcprojExplorer {
    static rootPath: string = '';
    static vcprojPathEventEmitter = new vscode.EventEmitter<string>();
    static vcprojExplorer: vscode.TreeView<VcprojViewItem> = null;
    static vcprojTreeDataProvider: VcprojFileTreeDataProvider = null;

    public static checkWorkspaceFolders(): boolean {
        return vscode.workspace.workspaceFolders != null 
            && vscode.workspace.workspaceFolders.length > 0;
    }

    public static init(): void {
        this.rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        vscode.commands.registerCommand('vcprojExplorer.openVcproj', async () => {
            await this.cmdSetVcprojPath();
            this.openVcropj();
        });
        vscode.commands.registerCommand('vcprojExplorer.openFile', this.cmdOpenFile.bind(this));
        vscode.commands.registerCommand("vcprojExplorer.goInto", this.goInto.bind(this));
        vscode.commands.registerCommand("vcprojExplorer.goHome", this.goHome.bind(this));

        vscode.window.onDidChangeActiveTextEditor((e) => { this.setViewItemSelected(e.document.fileName); });

        this.openVcropj();
        
        vscode.commands.executeCommand("setContext", "vcprojView.enable", true);
    }

    private static async cmdSetVcprojPath(): Promise<void> {
        const uri = await vscode.window.showOpenDialog({
            openLabel: "Open .vcproj",
            defaultUri: vscode.workspace.workspaceFolders[0].uri,
            canSelectFiles: false,
            filters: {
                vcproj: ['vcproj']
            }
        });
        
        if(!uri || uri.length <= 0) 
            return;
        const path = Path.relative(this.rootPath, uri[0].fsPath);
        await vscode.workspace.getConfiguration("vcprojexplorer").update('file', path);
    }

    private static async cmdOpenFile(resource: string): Promise<void> {
        vscode.window.showTextDocument(
            await vscode.workspace.openTextDocument(resource), 
            { preserveFocus: true }
        );
    }

    private static async openVcropj(): Promise<void> {
        let vcprojPath: string = vscode.workspace.getConfiguration("vcprojexplorer").get('file');
        if (vcprojPath.length <= 0) {
            return;
        }
        if (this.vcprojExplorer) {
            this.vcprojExplorer.dispose();
        }
        const path = Path.resolve(this.rootPath, vcprojPath);
        this.vcprojExplorer = vscode.window.createTreeView("vcprojView",
            {
                treeDataProvider: (this.vcprojTreeDataProvider = new VcprojFileTreeDataProvider(path)),
                showCollapseAll: true,
                canSelectMany: false,
            }
        );
        this.vcprojExplorer.title += `(${Path.basename(path)})`;
        this.vcprojExplorer.onDidChangeVisibility((e) => {
            this.setViewItemSelected();
        });
    }

    private static async setViewItemSelected(fileUri?: string) : Promise<void> {
        if (!this.vcprojTreeDataProvider || !this.vcprojExplorer?.visible)
            return;
        let viewItem = await this.vcprojTreeDataProvider.find(fileUri || vscode.window.activeTextEditor.document.fileName);
        if (!viewItem)
            return;
        this.vcprojExplorer.reveal(viewItem);
    }

    private static goInto(value: VcprojViewItem): void {
        if (value == null || !value.filter) {
            return;
        }
        this.vcprojTreeDataProvider.goInto(value.label, value.filter);
        vscode.commands.executeCommand("setContext", "vcprojView.goInto", true);
        this.setViewItemSelected();
    }

    private static goHome(value: VcprojViewItem): void {
        this.vcprojTreeDataProvider.goHome();
        vscode.commands.executeCommand("setContext", "vcprojView.goInto", false);
        this.setViewItemSelected();
    }

}


export default VcprojExplorer;
