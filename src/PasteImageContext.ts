import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as moment from 'moment';
import { newTemporaryFilename, base64Encode } from './utils';
import { mkdir } from "shelljs";
import { VditorConfig } from './config';

export class PasteImageContext {

    public document?: vscode.TextDocument;

    public targetFile?: vscode.Uri;

    public convertToBase64: boolean = false;

    public removeTargetFileAfterConvert: boolean = false;

    public imgTag?: {
        width: string;
        height: string;
    } | null;


    public rendText(): string | undefined {
        let renderText: string | undefined;
        if (this.convertToBase64) {
            renderText = this.renderMdImageBase64();
        } else {
            renderText = this.renderMdFilePath();
        }
        return renderText;
    }

    private renderMdImageBase64(): string | undefined {

        let targetFilePath = this.targetFile!.fsPath;
        if (!targetFilePath || !fs.existsSync(targetFilePath)) {
            return;
        }

        let renderText = base64Encode(targetFilePath);
        let imgTag = this.imgTag;
        if (imgTag) {
            renderText = `<img src='data:image/png;base64,${renderText}' width='${imgTag.width}' height='${imgTag.height}'/>`;
        } else {
            renderText = `![](data:image/png;base64,${renderText})`;
        }

        const rmOptions: fs.RmOptions = {
            recursive: true,
            force: true
        };

        if (this.removeTargetFileAfterConvert) {
            fs.rmSync(targetFilePath, rmOptions);
        }

        return renderText;
    }


    private renderMdFilePath(): string | undefined {

        let fileUri = this.document!.uri;
        let languageId = this.document!.languageId;

        let docPath = fileUri.fsPath;

        // relative will be add backslash characters so need to replace '\' to '/' here.
        let imageFilePath = PasteImageContext.encodePath(path.relative(path.dirname(docPath), this.targetFile!.fsPath));

        if (languageId === 'markdown') {
            let imgTag = this.imgTag;
            if (imgTag) {
                return `<img src='${imageFilePath}' width='${imgTag.width}' height='${imgTag.height}'/>`;
            }
            return `![](${imageFilePath})`;
        } else {
            return imageFilePath;
        }
    }




    public static create(filename: string, document: vscode.TextDocument): PasteImageContext | undefined {
        let imagePath = PasteImageContext.genTargetImagePath(filename, document);
        if (!imagePath) { return; }
        return this.parsePasteImageContext(imagePath, document);
    }

    private static genTargetImagePath(filename: string, document: vscode.TextDocument): string | undefined {

        let fileUri = document.uri;
        if (fileUri.scheme === 'untitled') {
            vscode.window.showInformationMessage('Before pasting an image, you need to save the current edited file first.');
            return;
        }

        let filePath = fileUri.fsPath;
        var folderPathFromConfig = PasteImageContext.replacePredefinedVars(VditorConfig.folderPathFromConfig, document);

        if (folderPathFromConfig && (folderPathFromConfig.length !== folderPathFromConfig.trim().length)) {
            vscode.window.showErrorMessage('The specified path is invalid: "' + folderPathFromConfig + '"');
            return;
        }

        // image file name
        let imageFileName = moment().format("Y-MM-DD-HH-mm-ss") + filename;
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
    private static parsePasteImageContext(inputVal: string, document: vscode.TextDocument): PasteImageContext | undefined {

        inputVal = PasteImageContext.replacePredefinedVars(inputVal, document);
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

        let pasteImgContext = new PasteImageContext();
        pasteImgContext.document = document;
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

        if (VditorConfig.enableImgTagConfig && inputUri.query) {
            // parse `<filepath>[?width,height]`. for example. /abc/abc.png?200,100
            let ar = inputUri.query.split(',');
            if (ar) {
                pasteImgContext.imgTag = {
                    width: ar[0],
                    height: ar[1]
                };
            }
        }
        let imgPath = pasteImgContext?.targetFile?.fsPath;
        if (!imgPath || !PasteImageContext.prepareDirForFile(imgPath)) {
            vscode.window.showErrorMessage('Make folder failed:' + imgPath);
            return;
        }

        return pasteImgContext;
    }



    /**
* Replace all predefined variable.
* @param str path
* @returns
*/
    public static replacePredefinedVars(str: string, document: vscode.TextDocument) {
        let replaceMap: any = {
            "${workspaceRoot}": vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri.fsPath || '',
        };
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


    /**
     * prepare directory for specified file.
     * @param filePath
     */
    public static prepareDirForFile(filePath: string): boolean {
        let dirName = path.dirname(filePath);
        try {
            mkdir("-p", dirName);
        } catch (error) {
            console.log(error);
            return false;
        }
        return true;
    }




    public static encodePath(filePath: string): string {
        filePath = filePath.replace(/\\/g, '/');

        if (VditorConfig.encodePathConfig === "encodeURI") {
            filePath = encodeURI(filePath);
        } else if (VditorConfig.encodePathConfig === "encodeSpaceOnly") {
            filePath = filePath.replace(/ /g, "%20");
        }
        return filePath;
    }



}
