// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { VcprojFileTreeDataProvider, VcprojViewItem } from './vcprojTreeDataProvider';
import * as Path from 'path';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	if (vscode.workspace.workspaceFolders == null 
		|| vscode.workspace.workspaceFolders.length === 0) {
        return;
	}
	vscode.commands.executeCommand("setContext", "vcprojView.enable", true);
	
	const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
	let vcprojExplorer: vscode.TreeView<VcprojViewItem> = null;
	let vcprojTreeDataProvider: VcprojFileTreeDataProvider = null;

	const vcprojPathEventEmitter = new vscode.EventEmitter<string>();
	vcprojPathEventEmitter.event(async (vcprojPath) => {
		if (vcprojPath.length <= 0) {
			return;
		}
		if (vcprojExplorer) {
			vcprojExplorer.dispose();
		}
		const path = Path.resolve(rootPath, vcprojPath);
		vcprojExplorer = vscode.window.createTreeView("vcprojView",
            {
                treeDataProvider: (vcprojTreeDataProvider = new VcprojFileTreeDataProvider(path)),
                showCollapseAll: true,
                canSelectMany: false,
            }
        );
        vcprojExplorer.title += `(${Path.basename(path)})`;
	});

	vscode.commands.registerCommand('vcprojExplorer.openVcproj', async () => {
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
		const path = Path.relative(rootPath, uri[0].fsPath);
		await vscode.workspace.getConfiguration("vcprojexplorer").update('file', path);
		vcprojPathEventEmitter.fire(path);
	});
	vscode.commands.registerCommand('vcprojExplorer.openFile', async (resource) => {
		let doc = await vscode.workspace.openTextDocument(resource); // calls back into the provider
		await vscode.window.showTextDocument(doc);
	});
	vscode.commands.registerCommand("vcprojExplorer.goInto",
		(value: VcprojViewItem) => {
			if (value == null || !value.filter) {
				return;
			}
			vcprojTreeDataProvider.goInto(value.label, value.filter);
			vscode.commands.executeCommand("setContext", "vcprojView.goInto", true);
		}
	);
	vscode.commands.registerCommand("vcprojExplorer.goHome",
		() => {
			vcprojTreeDataProvider.goHome();
			vscode.commands.executeCommand("setContext", "vcprojView.goInto", false);
		}
	);

	vcprojPathEventEmitter.fire(vscode.workspace.getConfiguration("vcprojexplorer").get('file'));
}

// this method is called when your extension is deactivated
export function deactivate() {}