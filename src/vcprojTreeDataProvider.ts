import * as vscode from 'vscode';
import {VcprojFile} from './vcprojFileParser';
import * as path from "path";
import * as _ from "underscore";

export type VcprojViewItemContextValue = 'FILE' | 'FILTER';

export class VcprojViewItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: VcprojViewItemContextValue,      
        tooltipText?: string,
        public readonly filter?: VcprojFile.Filter
      ) {
        super(label, collapsibleState);
        this.tooltip = tooltipText;
      }
}

export class VcprojFileTreeDataProvider implements vscode.TreeDataProvider<VcprojViewItem> {
    protected file: VcprojFile = undefined;
    protected root: String = '';
    private treeDataEventEmitter = new vscode.EventEmitter<VcprojViewItem | void>();
    public readonly onDidChangeTreeData: vscode.Event<VcprojViewItem | void> = this.treeDataEventEmitter.event;
    protected goIntoFilter: VcprojFile.Filter = undefined;
    
    constructor(
        public readonly vcprojFilePath: string
    ) {
        this.file = new VcprojFile(vcprojFilePath);
        this.root = path.dirname(vcprojFilePath);
    }
    
    getTreeItem(element: VcprojViewItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: VcprojViewItem): Promise<VcprojViewItem[]> {
        if (element) {
            return Promise.resolve(this.getViewItem(element.filter));
        }
        if (this.goIntoFilter) {
            return Promise.resolve(this.getViewItem(this.goIntoFilter));
        }
        const data = await this.file.ParseXml();
        return Promise.resolve(this.getViewItem(this.file.getFiles()));
    }

    private getViewItem(files: VcprojFile.Files | VcprojFile.Filter): VcprojViewItem[] {
        let viewItems: VcprojViewItem[] = [];
        
        if (files?.Filter && !_.isArray(files.Filter))
            files.Filter = [(files.Filter as VcprojFile.Filter)];
        if (_.isArray(files?.Filter))
        {
            const sortData = files.Filter.sort((a, b) => a.attr?.Name.toLowerCase() >= b.attr?.Name.toLowerCase() ? 1 : -1);
            for (let v of sortData) {
                viewItems.push(
                    new VcprojViewItem(
                        v.attr?.Name,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'FILTER',
                        undefined,
                        v
                    )
                );
            }
        }

        if (files?.File && !_.isArray(files.File))
            files.File = [(files.File as VcprojFile.File)];
        if (_.isArray(files?.File))
        {
            const sortData = files.File.sort((a, b) => a.attr?.RelativePath.toLowerCase() >= b.attr?.RelativePath.toLowerCase() ? 1 : -1);
            for (let v of sortData) {
                let fileItem = new VcprojViewItem(
                    path.basename(v.attr?.RelativePath),
                    vscode.TreeItemCollapsibleState.None,
                    'FILE',
                    v.attr?.RelativePath
                );
                let fileUri = path.normalize(this.root + '/' + v.attr?.RelativePath);
                fileItem.command = {
                    command: 'vcprojExplorer.openFile',
                    title: "Open File",
                    arguments: [fileUri], 
                };
                viewItems.push(fileItem);
            }
        }

        return viewItems;
    }

    public goInto(parentsLable:string, filter: VcprojFile.Filter): void {
        if (!filter) {
            return;
        }
        this.goIntoFilter = {
            attr: { Name: parentsLable },
            Filter: [filter]
        };
        this.treeDataEventEmitter.fire();
    }
    
    public goHome(): void {
        this.goIntoFilter = undefined;
        this.treeDataEventEmitter.fire();
    }
}


