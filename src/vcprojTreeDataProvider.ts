import * as vscode from 'vscode';
import {VcprojFile} from './vcprojFileParser';
import * as path from "path";
import * as _ from "underscore";

export type VcprojViewItemContextValue = 'FILE' | 'FILTER';

export class VcprojViewItem extends vscode.TreeItem {
    public readonly fileUri: string = '';

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: VcprojViewItemContextValue,
        root: string,      
        public readonly relativePath: string,
        public readonly filter?: VcprojFile.Filter,
        public readonly parent?: VcprojViewItem
      ) {
        super(label, collapsibleState);
        this.tooltip = relativePath;
        this.fileUri = path.normalize(root + '/' + (relativePath || ''));
      }
}

export class VcprojFileTreeDataProvider implements vscode.TreeDataProvider<VcprojViewItem> {
    protected file: VcprojFile = undefined;
    protected root: string = '';
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

    public getParent(element: VcprojViewItem): VcprojViewItem {
        return element.parent;
    }

    async getChildren(element?: VcprojViewItem): Promise<VcprojViewItem[]> {
        if (element) {
            return Promise.resolve(this.getViewItem(element.filter, element));
        }
        if (this.goIntoFilter) {
            return Promise.resolve(this.getViewItem(this.goIntoFilter, element));
        }
        const data = await this.file.ParseXml();
        return Promise.resolve(this.getViewItem(this.file.getFiles(), element));
    }

    private getViewItem(files: VcprojFile.Files | VcprojFile.Filter, parent: VcprojViewItem): VcprojViewItem[] {
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
                        this.root,
                        undefined,
                        v,
                        parent
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
                    this.root,
                    v.attr?.RelativePath,
                    undefined,
                    parent
                );
                fileItem.command = {
                    command: 'vcprojExplorer.openFile',
                    title: "Open File",
                    arguments: [fileItem.fileUri], 
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

    public async find(fileName: string, element ?: VcprojViewItem): Promise<VcprojViewItem> {
        let children = await this.getChildren(element);
        for (let viewItem of children) {
            if (viewItem.contextValue == 'FILTER')
            {
                let find = await this.find(fileName, viewItem);
                if (!find)
                    continue;
                return find;
            }
            else if (viewItem.fileUri != fileName)
                continue;
            return viewItem;
        }
    }

}
