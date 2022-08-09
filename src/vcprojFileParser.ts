import { readFile } from "fs";
import * as _ from "underscore";

const xmlParser = require('fast-xml-parser');

export class VcprojFile {
    private data: Object = {};
    private files: VcprojFile.Files = {};
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
        return this.files;
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
