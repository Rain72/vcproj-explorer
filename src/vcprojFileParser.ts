import { readFile } from "fs";
import * as _ from "underscore";

const xmlParser = require('fast-xml-parser');

export class VcprojFile {
    private data: Object = {};
    private files: VcprojFile.Files = {};
    private intoPath: string[] = undefined;
    constructor(
        public readonly path: string
    ) {       
    }

    public async ParseXml(): Promise<void> {
        const data = await new Promise((reslove, reject) => {
            readFile(this.path, 'utf8', (err, data) => err ? reject(err) : reslove(data));
        });
        this.data = xmlParser.parse(data, {
            attributeNamePrefix : "",
            attrNodeName: "attr", //default is 'false'
            textNodeName : "#text",
            ignoreAttributes : false,
            ignoreNameSpace : false,
        });
        this.files = this.data['VisualStudioProject']?.Files;
    }

    public get() : VcprojFile.Files | VcprojFile.Filter {
        if (_.isArray(this.intoPath))
        {
            const [success, filter] = this.getPathFilter(this.intoPath);
            return success
                ? {
                    attr: filter.attr,
                    Filter: filter,
                }
                : {
                    attr: { Name: "PATH NOT FOUND" },
                    Filter: [],
                }
        }
        return this.files;
    }

    public goInto(paths: string[]) : void {
        this.intoPath = paths;
    }

    private getPathFilter(paths: string[]): [boolean, undefined | VcprojFile.Filter] {
        let filter: VcprojFile.Filter = (this.files as VcprojFile.Filter);
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
        return [true, filter];
    }

    public clearInto() : void {
        this.intoPath = undefined;
    }

}

export module VcprojFile
{
    export interface File {
        attr?: { RelativePath: string },
    };
    
    export interface Filter {
        attr?: { Name: string },
        Filter?: Filter | Filter[],
        File?: File[],
    };

    export interface Files {
        Filter?: Filter[],
        File?: File | File[],
    }
}
