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
        this.document = vscode.window.activeTextEditor!.document;
        this.pasteTextStr((content: string) => {
            ImageSaver.writeToEditor(content);
        });
    }


    public copyFile(file: string): string {

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


    public pasteTextStr(callback: (data: string) => void) {
        var r = Command.getClipboardContentType(async (ctxType) => {
            switch (ctxType) {
                case ClipboardType.html:
                    {
                        Command.pasteTextHtml(async (text) => {
                            text = await this.pasteHtmlOrText(text);
                            callback(text);
                        });
                    }
                    break;
                case ClipboardType.text:
                    {
                        Command.pasteTextPlain(async (text) => {
                            text = await this.pasteHtmlOrText(text);
                            callback(text);
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

        if (r === true) {
            return;
        }
        //vscode 的api 默认只能读取文本
        vscode.env.clipboard.readText().then((content) => {
            ImageSaver.writeToEditor(content);
        });
    }

    public async pasteHtmlOrText(content: string): Promise<string> {

        if (content) {
            //如果是单个的图片url
            if (/^(http(s?):)([/|.|\w|\s|-])*\.(?:jpg|gif|png)/i.test(content)) {
                content = await this.pasteMDImageURL(content);
            }
            else {
                //如果是文本,html则转换成md
                if (/<[a-z][\s\S]*>/i.test(content)) {
                    content = this.nhm.translate(content);
                }
                //应用替换规则
                for (var i = 0; i < VditorConfig.rules.length; i++) {
                    let rule = VditorConfig.rules[i];
                    content = rule.replace(content);
                }
                //下载图片
                content = await replaceAsync(content, /!\[[^\]]*\]\((.*?)\s*("(?:.*[^"])")?\s*\)/gim, async (substring: string, ...args: any[]) => {
                    const urlParsed = url.parse(args[0]);
                    //检查是否有protocol,如果没有则是本地图片
                    if (urlParsed.protocol === null) {
                        return substring;
                    }
                    return await this.pasteMDImageURL(args[0]);
                });
            }
        }
        return content;
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


