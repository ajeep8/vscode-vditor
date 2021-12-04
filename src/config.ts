import * as vscode from 'vscode';
import * as path from 'path';
import * as moment from 'moment';
import { prepareDirForFile, fetchAndSaveFile, newTemporaryFilename, base64Encode } from './utils';


export class ConfigRule {

    public regExp: RegExp;
    public replaceExp: string;

    public constructor(regExp: string, options: string, replace: string) {
        this.regExp = new RegExp(regExp, options);
        this.replaceExp = replace;
    }

    public replace(str: string): string {
        if (this.regExp.test(str) === false) {
            return str;
        }
        return str.replace(this.regExp, this.replaceExp);
    }
}
export class PasteImageContext {
    public targetFile?: vscode.Uri;
    public convertToBase64: boolean = false;
    public removeTargetFileAfterConvert: boolean = false;
    public imgTag?: {
        width: string,
        height: string
    } | null;
}
export class VditorConfig {

    private _rules: Array<ConfigRule> = new Array<ConfigRule>();

    get rules(): Array<ConfigRule> {
        this._rules = [];
        let config = vscode.workspace.getConfiguration('Vditor');
        let rules = config.rules;
        for (var i = 0; i < rules.length; i++) {
            let rule = rules[i];
            this._rules.push(new ConfigRule(rule.regex, rule.options, rule.replace));
        }

        return this._rules;
    }

    get folderPathFromConfig(): string {
        let config = vscode.workspace.getConfiguration('Vditor');
        return config.imgSavePath;
    }

    get enableImgTagConfig(): boolean {
        let config = vscode.workspace.getConfiguration('Vditor');
        return config.enableImgTag;
    }

    get encodePathConfig(): string {
        let config = vscode.workspace.getConfiguration('Vditor');
        return config.encodePath;
    }

    public encodePath(filePath: string): string {
        filePath = filePath.replace(/\\/g, '/');

        if (this.encodePathConfig === "encodeURI") {
            filePath = encodeURI(filePath);
        } else if (this.encodePathConfig === "encodeSpaceOnly") {
            filePath = filePath.replace(/ /g, "%20");
        }
        return filePath;
    }

    public genTargetImagePath(filename: string, document: vscode.TextDocument | undefined = undefined): string | undefined {
        var selectText:string | undefined;
        if (document === undefined) {   // get current edit file path
            let editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            document = editor.document;


            // get selection as image file name, need check
            var selection = editor.selection;
            selectText = editor.document.getText(selection);

            if (selectText && !/^[^\\/:\*\?""<>|]{1,120}$/.test(selectText)) {
                vscode.window.showInformationMessage('Your selection is not a valid file name!');
                return;
            }
        }


        let fileUri = document.uri;
        if (!fileUri) { return; }
        if (fileUri.scheme === 'untitled') {
            vscode.window.showInformationMessage('Before pasting an image, you need to save the current edited file first.');
            return;
        }

        let filePath = fileUri.fsPath;
        var folderPathFromConfig = this.replacePredefinedVars(this.folderPathFromConfig,document)!;

        if (folderPathFromConfig && (folderPathFromConfig.length !== folderPathFromConfig.trim().length)) {
            vscode.window.showErrorMessage('The specified path is invalid: "' + folderPathFromConfig + '"');
            return;
        }

        // image file name
        let imageFileName = "";
        if (!selectText) {
            imageFileName = moment().format("Y-MM-DD-HH-mm-ss") + filename;
        } else {
            imageFileName = selectText + filename;
        }

        // image output path
        let folderPath = path.dirname(filePath);
        let imagePath = "";

        // generate image path
        if (path.isAbsolute(folderPathFromConfig)) {
            // important: replace must be done at the end, path.join() will build a path with backward slashes (\)
            imagePath = path.join(folderPathFromConfig, imageFileName).replace(/\\/g, '/');
        } else {
            // important: replace must be done at the end, path.join() will build a path with backward slashes (\)
            imagePath = path.join(folderPath, folderPathFromConfig, imageFileName).replace(/\\/g, '/');
        }

        return imagePath;
    }

    

    /**
     * Generate different Markdown content based on the value entered.
     * for example:
     * ./assets/test.png        => ![](./assets/test.png)
     * ./assets/test.png?200,10 => <img src="./assets/test.png" width="200" height="10"/> 
     * ./assets/                => ![](![](data:image/png;base64,...)
     * ./assets/?200,10         => <img src="data:image/png;base64,..." width="200" height="10"/>
     * 
     * @param inputVal 
     * @returns 
     */
    public parsePasteImageContext(inputVal: string, document: vscode.TextDocument|undefined = undefined): PasteImageContext | undefined {
        if (!inputVal) { return; }
        if(document ===undefined)
        {
            let editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            document = editor.document;
        }
        inputVal = this.replacePredefinedVars(inputVal,document)!;

        //leading and trailling white space are invalidate 
        if (inputVal && (inputVal.length !== inputVal.trim().length)) {
            vscode.window.showErrorMessage('The specified path is invalid: "' + inputVal + '"');
            return;
        }

        // ! Maybe it is a bug in vscode.Uri.parse():
        // > vscode.Uri.parse("f:/test/images").fsPath 
        // '/test/images'
        // > vscode.Uri.parse("file:///f:/test/images").fsPath 
        // 'f:/test/image'                
        // 
        // So we have to add file:/// scheme. while input value contain a driver character 
        if (inputVal.substr(1, 1) === ':') {
            inputVal = 'file:///' + inputVal;
        }

        let pasteImgContext = new PasteImageContext;

        let inputUri = vscode.Uri.parse(inputVal);

        if (inputUri.fsPath.slice(inputUri.fsPath.length - 1) === '/') {
            // While filename is empty(ex: /abc/?200,20),  paste clipboard to a temporay file, then convert it to base64 image to markdown. 
            pasteImgContext.targetFile = newTemporaryFilename();
            pasteImgContext.convertToBase64 = true;
            pasteImgContext.removeTargetFileAfterConvert = true;
        } else {
            pasteImgContext.targetFile = inputUri;
            pasteImgContext.convertToBase64 = false;
            pasteImgContext.removeTargetFileAfterConvert = false;
        }

        if (this.enableImgTagConfig && inputUri.query) {
            // parse `<filepath>[?width,height]`. for example. /abc/abc.png?200,100
            let ar = inputUri.query.split(',');
            if (ar) {
                pasteImgContext.imgTag = {
                    width: ar[0],
                    height: ar[1]
                };
            }
        }

        return pasteImgContext;
    }


    /**
     * Replace all predefined variable.
     * @param str path
     * @returns 
     */
    public replacePredefinedVars(str: string, document: vscode.TextDocument|undefined = undefined) {
        let replaceMap: any = {
            "${workspaceRoot}": vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri.fsPath || '',
        };

        if(document ===undefined)
        {
            let editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            document = editor.document;
        }
        let fileUri = document.uri;
        let filePath = fileUri && fileUri.fsPath;

        if (filePath) {
            replaceMap["${fileExtname}"] = path.extname(filePath);
            replaceMap["${fileBasenameNoExtension}"] = path.basename(filePath, replaceMap["${fileExtname}"]);
            replaceMap["${fileBasename}"] = path.basename(filePath);
            replaceMap["${fileDirname}"] = path.dirname(filePath);
        }

        for (var search in replaceMap) {
            str = str.replace(search, replaceMap[search]);
        }

        // User may be input a path with backward slashes (\), so need to replace all '\' to '/'.
        return str.replace(/\\/g, '/');
    }


  
}
