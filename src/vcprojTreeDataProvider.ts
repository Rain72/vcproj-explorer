import * as vscode from 'vscode';
import {VcprojFile} from './vcprojFileParser';
import * as path from "path";
import * as _ from "underscore";

export type VcprojViewItemContextValue = 'FILE' | 'FILTER' | 'FAV_FILE' | 'FAV_FILTER';
export enum VIEW {
    HOME,
    GO_INTO,
    FAVORITE,
};

export class VcprojViewItem extends vscode.TreeItem {
    public readonly fileUri: string = '';

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public contextValue: VcprojViewItemContextValue,
        root: string,      
        public readonly relativePath: string,
        public readonly filter?: VcprojFile.Filter,
        public readonly parent?: VcprojViewItem
      ) {
        super(label, collapsibleState);
        this.tooltip = relativePath;
        this.fileUri = path.normalize(root + '/' + (relativePath || ''));
        if (this.IsFavorite())
            this.iconPath = new vscode.ThemeIcon('pin');
      }
    
    public IsFavorite(): boolean {
        return this.contextValue == 'FAV_FILE' || this.contextValue == 'FAV_FILTER';
    }

    public IsFile(): boolean {
        return this.contextValue == 'FAV_FILE' || this.contextValue == 'FILE';
    }

    public IsFilter(): boolean {
        return this.contextValue == 'FAV_FILTER' || this.contextValue == 'FILTER';
    }
}

export class VcprojFileTreeDataProvider implements vscode.TreeDataProvider<VcprojViewItem> {
    protected file: VcprojFile = undefined;
    protected root: string = '';
    private treeDataEventEmitter = new vscode.EventEmitter<VcprojViewItem | void>();
    public readonly onDidChangeTreeData: vscode.Event<VcprojViewItem | void> = this.treeDataEventEmitter.event;
    private intoPath: string[] = undefined;
    private favoriteMap: { [key: string]: true } = {};
    protected view : VIEW = VIEW.HOME;
        
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
        return Promise.resolve(this.getViewItem(this.file.get(), element));
    }
    
    private IsFavorite(files: VcprojFile.File | VcprojFile.Filter, parent: VcprojViewItem): boolean {
        if (_.isUndefined(files.attr))
            return false;
        let paths = this.getPath(parent);
        if ('Name' in files.attr) {
            paths = paths.concat(files.attr.Name);
        }
        else if ('RelativePath' in files.attr) {
            paths = paths.concat(path.basename(files.attr.RelativePath));
        }
        else {
            return false;
        }
        return this.favoriteMap[paths.join('/')] == true;
    }

    private genViewItemFilter(files: VcprojFile.Files | VcprojFile.Filter, parent: VcprojViewItem): VcprojViewItem[] {
        if (_.isUndefined(files?.Filter))
            return [];
        _.isArray(files.Filter) || (files.Filter = [(files.Filter as VcprojFile.Filter)]);
        return files.Filter
            .sort((a, b) => a.attr?.Name.toLowerCase() >= b.attr?.Name.toLowerCase() ? 1 : -1)
            .map((v) => new VcprojViewItem(
                v.attr?.Name,
                vscode.TreeItemCollapsibleState.Collapsed,
                this.IsFavorite(v, parent) ? 'FAV_FILTER' :'FILTER',
                this.root,
                undefined,
                v,
                parent
            ));
    }

    private genViemItemFile(files: VcprojFile.Files | VcprojFile.Filter, parent: VcprojViewItem): VcprojViewItem[] {
        if (_.isUndefined(files?.File))
            return [];
        _.isArray(files.File) || (files.File = [(files.File as VcprojFile.File)]);
        return files.File
            .sort((a, b) => a.attr?.RelativePath.toLowerCase() >= b.attr?.RelativePath.toLowerCase() ? 1 : -1)
            .map((v) => {
                let fileItem =  new VcprojViewItem(
                    path.basename(v.attr?.RelativePath),
                    vscode.TreeItemCollapsibleState.None,
                    this.IsFavorite(v, parent) ? 'FAV_FILE' :'FILE',
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
                return fileItem;
            });
    }

    private getViewItem(files: VcprojFile.Files | VcprojFile.Filter, parent: VcprojViewItem): VcprojViewItem[] {
        if (this.view == VIEW.GO_INTO && _.isUndefined(parent)) {
            const [success, filter] = this.getPathFilter(files, this.intoPath);
            if (!success)
                return [];
            return this.genViewItemFilter(filter, parent)
                .concat(this.genViemItemFile(filter, parent));
        }

        let item = this.genViewItemFilter(files, parent)
            .concat(this.genViemItemFile(files, parent));

        if (this.view == VIEW.FAVORITE) {
            return this.filterFavorite(item, parent);
        }
        return item;
    }

    private genG

    private getPathFilter(files: VcprojFile.Files | VcprojFile.Filter, paths: string[]): [boolean, undefined | VcprojFile.Filter] {
        let filter: VcprojFile.Filter = (files as VcprojFile.Filter);
        let pathsClone = _.clone(paths);
        let name: string = undefined;
        while (!_.isUndefined(name = pathsClone.shift())) {
            if (!_.isArray(filter.Filter))
                return [false, undefined];

            let findIndex = filter.Filter.findIndex((v) => v.attr?.Name == name);
            if (findIndex == -1)
                return [false, undefined];
            filter = filter.Filter[findIndex];
        }
        if (_.isArray(filter))
            return [false, undefined];
        return [
            true, 
            {
                attr: filter.attr,
                Filter: filter
            }
        ];
    }

    private filterFavorite(viewItem:VcprojViewItem[], parent: VcprojViewItem): VcprojViewItem[] {
        if (parent && parent.IsFavorite())
            return viewItem;
        let passItem: VcprojViewItem[] = [];
        for (let item of viewItem) {
            if (item.IsFavorite()) {
                passItem.push(item);
                continue;
            }
            
            // check FAVORITE in FILTER
            if (!item.IsFilter()) 
                continue;
            let subItem = this.genViewItemFilter(item.filter, item)
                            .concat(this.genViemItemFile(item.filter, item));
            passItem = passItem.concat(this.filterFavorite(subItem, undefined)); //recursive
        }
        return passItem;
    }

    public goInto(value: VcprojViewItem): void {
        if (!value) {
            return;
        }
        this.view = VIEW.GO_INTO;
        this.intoPath = this.getPath(value);
        this.treeDataEventEmitter.fire();
    }

    protected getPath(value: VcprojViewItem): string[] {
        if (_.isUndefined(value))
            return [];
        let paths: string[] = [];
        paths.push(value.IsFile() ? path.basename(value.relativePath) : value.filter.attr.Name);
        let element: VcprojViewItem = value.parent;
        while (!_.isUndefined(element?.filter?.attr?.Name)) {
            paths.push(element.filter.attr.Name);
            element = element.parent;
        }
        return paths.reverse();
    }
    
    public goHome(): void {
        this.view = VIEW.HOME;
        this.treeDataEventEmitter.fire();
    }

    public async refresh(): Promise<void> {
        await this.file.ParseXml();
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

    public addFavorite(paths: string[]) : void {
        if (paths.length <= 0)
            return;
        const path = paths.join('/');
        this.favoriteMap[path] = true;
    }

    public removeFavorite(paths: string[]) : void {
        if (paths.length <= 0)
            return;
        const path = paths.join('/');
        delete this.favoriteMap[path];
    }

    public favorite(element: VcprojViewItem): void {
        const paths = this.getPath(element);
        if (element.IsFavorite())
            this.removeFavorite(paths);
        else
            this.addFavorite(paths);
        this.treeDataEventEmitter.fire();
    }

    public getView(toString: boolean) : String | VIEW {
        return toString ? VIEW[this.view] : this.view;
    }

    public goFavorite(): void {
        this.view = VIEW.FAVORITE;
        this.treeDataEventEmitter.fire();
    }

    public getFavorite(): String[] {
        return Object.keys(this.favoriteMap);
    }

}
