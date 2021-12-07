import { NodeHtmlMarkdown } from 'node-html-markdown';
import { VditorConfig } from './config';
import { PasteImageContext } from "./pasteImageContext";
import { Command, ClipboardType } from './command';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as url from "url";
import * as http from "http";
import * as https from "https";
import replaceAsync from "string-replace-async";


export class ImageSaver {

    private static singleton: ImageSaver;

    public static getInstance() {
        if (ImageSaver.singleton === undefined || ImageSaver.singleton === null) {
            ImageSaver.singleton = new ImageSaver();
        }
        return ImageSaver.singleton;
    }

    private nhm: NodeHtmlMarkdown;
    private constructor() {
        this.nhm = new NodeHtmlMarkdown(
            /* options (optional) */ {},
            /* customTransformers (optional) */ undefined,
            /* customCodeBlockTranslators (optional) */ undefined
        );
    }

    public document: vscode.TextDocument | undefined;

    public pasteText() {
        this.pasteTextStr(vscode.window.activeTextEditor!.document, (content: string) => {
            ImageSaver.writeToEditor(content);
        });
    }


    public copyFile(document: vscode.TextDocument, file: string): string {
        this.document = document;
        let filename = path.basename(file);
        let pasteImgContext = PasteImageContext.create(filename, this.document!);
        if (!pasteImgContext) { return ""; }
        fs.copyFile(file, pasteImgContext.targetFile!.fsPath, (err) => {
            if (err) {
                console.log("Error Found:", err);
            }
        });
        return pasteImgContext?.rendText()!;
    }


    public pasteTextStr(document: vscode.TextDocument, callback: (data: string) => void) {
        this.document = document;
        Command.getClipboardContentType(async (ctxType) => {
            switch (ctxType) {
                case ClipboardType.html:
                case ClipboardType.text:
                    {
                        Command.pasteTextPlain(async (text) => {
                            if (text) {
                                let newContent: string;
                                //如果是单个的图片url
                                if (/^(http(s?):)([/|.|\w|\s|-])*\.(?:jpg|gif|png)/i.test(text)) {
                                    newContent = await this.pasteMDImageURL(text);
                                }
                                else {
                                    //如果是文本,html
                                    newContent = await this.handlerText(text);
                                }
                                callback(newContent);
                            }
                        });
                    }
                    break;
                case ClipboardType.image:
                    {
                        var text = await this.pasteImage();
                        callback(text);
                    }
                    break;
            }
        });
    }


    public async pasteMD(document: vscode.TextDocument, content: string): Promise<string> {
        this.document = document;
        //应用替换规则
        for (var i = 0; i < VditorConfig.rules.length; i++) {
            let rule = VditorConfig.rules[i];
            content = rule.replace(content);
        }
        //下载图片
        return await replaceAsync(content, /!\[[^\]]*\]\((.*?)\s*("(?:.*[^"])")?\s*\)/gim, async (substring: string, ...args: any[]) => {
            const urlParsed = url.parse(args[0]);
            if (urlParsed.protocol === null) {
                return substring;
            }
            return await this.pasteMDImageURL(args[0]);
        });
    }

    /**
     * 编辑器下黏贴文本,需要借助工具才能黏贴html,否则只能黏贴文本,而文本不会含有图片
     */
    private async handlerText(content: string): Promise<string> {
        //如果时html则转换成md
        if (/<[a-z][\s\S]*>/i.test(content)) {
            content = this.nhm.translate(content);
        }
        //应用替换规则
        for (var i = 0; i < VditorConfig.rules.length; i++) {
            let rule = VditorConfig.rules[i];
            content = rule.replace(content);
        }
        //下载图片
        return await replaceAsync(content, /!\[[^\]]*\]\((.*?)\s*("(?:.*[^"])")?\s*\)/gim, async (substring: string, ...args: any[]) => {
            const urlParsed = url.parse(args[0]);
            if (urlParsed.protocol === null) {
                return substring;
            }
            return await this.pasteMDImageURL(args[0]);
        });
    }


    //将url中的图片下载到本地
    private async pasteMDImageURL(imageUrl: string): Promise<string> {
        let filename = imageUrl.split('/').pop()!.split('?')[0];
        let pasteImgContext = PasteImageContext.create(filename, this.document!);
        await this.fetchAndSaveFile(imageUrl, pasteImgContext!.targetFile!.fsPath);
        return pasteImgContext?.rendText()!;
    }


    //粘贴板直接黏贴的图片
    private pasteImage(): Promise<string> {
        let r = (Math.random() + 1).toString(36).substring(7);
        let pasteImgContext = PasteImageContext.create(`${r}.png`, this.document!)!;
        // save image and insert to current edit file
        return new Promise((resolve, reject) => {
            Command.saveClipboardImageToFileAndGetPath(pasteImgContext.targetFile!.fsPath, imagePath => {
                if (!imagePath || imagePath === 'no image') {
                    vscode.window.showInformationMessage('There is not an image in the clipboard.');
                    reject('no image');
                }
                else {
                    resolve(pasteImgContext?.rendText()!);
                }
            });
        });
    }

    /**
 * Fetch file to specified local folder
 * @param fileURL
 * @param dest
 */
    private fetchAndSaveFile(fileURL: string, filepath: string) {
        let dest = path.dirname(filepath);
        let basename = path.basename(filepath);
        return new Promise((resolve, reject) => {
            const timeout = 10000;
            const urlParsed = url.parse(fileURL);
            const uri = urlParsed.pathname!.split("/");

            let req;
            let filename = basename || uri[uri.length - 1].match(/(\w*\.?-?)+/)![0];

            if (urlParsed.protocol === null) {
                fileURL = "http://" + fileURL;
            }

            req = urlParsed.protocol === "https:" ? https : http;

            let request = req
                .get(fileURL, response => {
                    // Make sure extension is present (mostly for images)
                    if (filename.indexOf(".") < 0) {
                        const contentType = response.headers["content-type"]!;
                        filename += `.${contentType.split("/")[1]}`;
                    }

                    const targetPath = `${dest}/${filename}`;

                    response.on("end", function () {
                        resolve(targetPath);
                    });

                    if (response.statusCode === 200) {
                        if (PasteImageContext.prepareDirForFile(targetPath)) {
                            var file = fs.createWriteStream(targetPath);
                            response.pipe(file);
                        } else {
                            reject("Make folder failed:" + dest);
                        }
                    } else {
                        reject(`Downloading ${fileURL} failed`);
                    }
                }).setTimeout(timeout, () => {
                    request.abort();
                    reject(`Request Timeout(${timeout} ms):Download ${fileURL} failed!`);
                })
                .on("error", e => {
                    reject(`Downloading ${fileURL} failed! Please make sure URL is valid.`);
                });
        });
    }


    private static writeToEditor(content: string): Thenable<boolean> {
        var editor = vscode.window.activeTextEditor!;
        let position = new vscode.Position(editor.selection.start.line, editor.selection.start.character);
        return editor.edit((editBuilder) => {
            editBuilder.insert(position, content);
        });
    }
}


