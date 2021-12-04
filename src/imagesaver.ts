import { NodeHtmlMarkdown } from 'node-html-markdown';
import { prepareDirForFile, fetchAndSaveFile, newTemporaryFilename, base64Encode } from './utils';
import { VditorConfig, PasteImageContext, ConfigRule } from './config';
import { Command, ClipboardType } from './command';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

export class ImageSaver {

    private static singleton: ImageSaver;

    public static getInstance() {
        if (ImageSaver.singleton === undefined || ImageSaver.singleton === null) {
            ImageSaver.singleton = new ImageSaver();
        }
        return ImageSaver.singleton;
    }

    private config: VditorConfig;
    private nhm: NodeHtmlMarkdown;
    private constructor() {
        this.config = new VditorConfig();
        this.nhm = new NodeHtmlMarkdown(
            /* options (optional) */ {},
            /* customTransformers (optional) */ undefined,
            /* customCodeBlockTranslators (optional) */ undefined
        );
    }

    public pasteText() {
        var ret = Command.getClipboardContentType((ctxType) => {
            switch (ctxType) {
                case ClipboardType.html:
                case ClipboardType.text:
                    {
                        Command.pasteTextPlain((text) => {
                            if (text) {
                                let newContent: string;
                                //如果是单个的图片url
                                if (/^(http(s?):)([/|.|\w|\s|-])*\.(?:jpg|gif|png)/i.test(text)) {
                                    newContent = this.pasteMDImageURL(text);
                                }
                                else {
                                    //如果是文本,html
                                    newContent = this.handlerText(text);
                                    newContent = this.handlerImage(newContent);
                                }
                                ImageSaver.writeToEditor(newContent);
                            }
                        });
                    }
                    break;
                case ClipboardType.image:
                    {
                        this.pasteImage();
                    }
                    break;
            }
        });
    }

    /**
     * HandlerText
     */
    public handlerText(content: string): string {
        for (var i = 0; i < this.config.rules.length; i++) {
            let rule = this.config.rules[i];
            content = rule.replace(content);
        }

        if (ImageSaver.isHTML(content)) {
            content = this.nhm.translate(content);
        }
        return content;
    }

    /**
     * HandlerImage
     */
    public handlerImage(content: string): string {
        content = content.replace(/!\[[^\]]*\]\((.*?)\s*("(?:.*[^"])")?\s*\)/gim, (substring: string, ...args: any[]) => {
            return this.pasteMDImageURL(args[0]);
        });
        return content;
    }

    private pasteMDImageURL(imageUrl: string): string {

        let failImageUrl: string = `![](${imageUrl})`;

        let filename = imageUrl.split('/').pop()!.split('?')[0];

        let imagePath = this.config.genTargetImagePath(filename);
        if (!imagePath) { return failImageUrl; }

        let pasteImgContext = this.config.parsePasteImageContext(imagePath);
        if (!pasteImgContext) { return failImageUrl; }

        this.downloadFile(imageUrl, pasteImgContext!);

        let renderText: string | undefined;
        if (pasteImgContext!.convertToBase64) {
            renderText = this.renderMdImageBase64(pasteImgContext!);
        } else {
            renderText = this.renderMdFilePath(pasteImgContext!);
        }
        if (!renderText) { return failImageUrl; }

        return renderText;
    }




    private async downloadFile(imageUrl: string, pasteImgContext: PasteImageContext) {

        let imgPath = pasteImgContext.targetFile!.fsPath;
        if (!prepareDirForFile(imgPath)) {
            vscode.window.showErrorMessage('Make folder failed:' + imgPath);
            return;
        }

        // save image and insert to current edit file
       await  fetchAndSaveFile(imageUrl, imgPath)
            .then((imagePath: any) => {
                console.log(`${imageUrl} download file to ${imagePath}`);
            }).catch(err => {
                vscode.window.showErrorMessage('Download failed:' + err);
            });
    }





    private renderMdImageBase64(pasteImgContext: PasteImageContext): string | undefined {

        let targetFilePath = pasteImgContext.targetFile!.fsPath;
        if (!targetFilePath || !fs.existsSync(targetFilePath)) {
            return;
        }

        let renderText = base64Encode(targetFilePath);
        let imgTag = pasteImgContext.imgTag;
        if (imgTag) {
            renderText = `<img src='data:image/png;base64,${renderText}' width='${imgTag.width}' height='${imgTag.height}'/>`;
        } else {
            renderText = `![](data:image/png;base64,${renderText})`;
        }

        const rmOptions: fs.RmOptions = {
            recursive: true,
            force: true
        };

        if (pasteImgContext.removeTargetFileAfterConvert) {
            fs.rmSync(targetFilePath, rmOptions);
        }

        return renderText;
    }


    private renderMdFilePath(pasteImgContext: PasteImageContext,document: vscode.TextDocument | undefined = undefined): string | undefined {
        if(document ===undefined)
        {
            let editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            document = editor.document;
        }
        let fileUri = document.uri;
        if (!fileUri) { return; }

        let languageId = document.languageId;

        let docPath = fileUri.fsPath;

        // relative will be add backslash characters so need to replace '\' to '/' here.
        let imageFilePath = this.config.encodePath(path.relative(path.dirname(docPath), pasteImgContext.targetFile!.fsPath));

        if (languageId === 'markdown') {
            let imgTag = pasteImgContext.imgTag;
            if (imgTag) {
                return `<img src='${imageFilePath}' width='${imgTag.width}' height='${imgTag.height}'/>`;
            }
            return `![](${imageFilePath})`;
        } else {
            return imageFilePath;
        }
    }

    private pasteImage() {
        let r = (Math.random() + 1).toString(36).substring(7);
        let targetPath = this.config.genTargetImagePath(`${r}.png`);
        if (!targetPath) { return; }

        let pasteImgContext = this.config.parsePasteImageContext(targetPath);
        if (!pasteImgContext || !pasteImgContext.targetFile) { return; }

        let imgPath = pasteImgContext.targetFile.fsPath;
        if (!prepareDirForFile(imgPath)) {
            vscode.window.showErrorMessage('Make folder failed:' + imgPath);
            return;
        }
        // save image and insert to current edit file
        Command.saveClipboardImageToFileAndGetPath(imgPath, imagePath => {
            if (!imagePath) { return; }
            if (imagePath === 'no image') {
                vscode.window.showInformationMessage('There is not an image in the clipboard.');
                return;
            }
            this.renderMarkdownLink(pasteImgContext!);
        });
    }

    public renderMarkdownLink(pasteImgContext: PasteImageContext) {
        let editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        let renderText: string | undefined;
        if (pasteImgContext.convertToBase64) {
            renderText = this.renderMdImageBase64(pasteImgContext);
        } else {
            renderText = this.renderMdFilePath(pasteImgContext);
        }
        if (renderText) {
            editor.edit(edit => {
                let current = editor!.selection;
                if (current.isEmpty) {
                    edit.insert(current.start, renderText!);
                } else {
                    edit.replace(current, renderText!);
                }
            });
        }
    }



    public copyFile(file: string,document: vscode.TextDocument) {

        let filename = path.basename(file);

        
        let targetPath = this.config.genTargetImagePath(filename,document);
        

        let failImageUrl: string = `![](${targetPath})`;


        if (!targetPath) { return failImageUrl; }

        let pasteImgContext = this.config.parsePasteImageContext(targetPath,document);
        if (!pasteImgContext) { return failImageUrl; }

        if (!prepareDirForFile(targetPath)) {
            vscode.window.showErrorMessage('Make folder failed:' + targetPath);
            return;
        }

        fs.copyFile(file, targetPath, (err) => {
            if (err) {
                console.log("Error Found:", err);
            }
        });

        let renderText: string | undefined;
        if (pasteImgContext!.convertToBase64) {
            renderText = this.renderMdImageBase64(pasteImgContext!);
        } else {
            renderText = this.renderMdFilePath(pasteImgContext!,document);
        }
        if (!renderText) { return failImageUrl; }

        return renderText;
    }



    private static isHTML(content: string): boolean {
        return /<[a-z][\s\S]*>/i.test(content);
    }

    private static writeToEditor(content: string): Thenable<boolean> {
        var editor = vscode.window.activeTextEditor!;
        let startLine = editor.selection.start.line;
        var selection = editor.selection;
        let position = new vscode.Position(startLine, selection.start.character);
        return editor.edit((editBuilder) => {
            editBuilder.insert(position, content);
        });
    }
}


