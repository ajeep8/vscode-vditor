import * as path from 'path';
import * as process from 'process';
import { spawn, ChildProcess } from 'child_process';
import * as vscode from 'vscode';


export enum ClipboardType {
    unkown = -1, html = 0, text, image
}
export class Command {

    private static scriptBasePath: string = '../assets/';


    public static getClipboardType(typeArray: string[]): ClipboardType {
        let contentType = ClipboardType.unkown;
        if (!typeArray) {
            return contentType;
        }

        let platform = process.platform;
        console.log('platform', platform);
        if (platform === "linux") {
            for (var i = 0; i < typeArray.length; i++) {
                var type = typeArray[i];
                if (type === "image/png") {
                    contentType = ClipboardType.image;
                    break;
                } else if (type === "text/html") {
                    contentType = ClipboardType.html;
                    break;
                } else {
                    contentType = ClipboardType.text;
                }
            }
        } else if (platform === "win32") {
            for (var i = 0; i < typeArray.length; i++) {
                var type = typeArray[i];
                if (type === "PNG" || type === "Bitmap") {
                    contentType = ClipboardType.image;
                    break;
                }
                //windows html format 解析麻烦,且如果是中文会乱码
                //https://docs.microsoft.com/zh-cn/windows/win32/dataxchg/html-clipboard-format
                else if(type === "HTML Format")
                {
                    contentType = ClipboardType.html;
                    break;
                }
                else if (type === "UnicodeText" || type === "Text" ) {
                    contentType = ClipboardType.text;
                    break;
                }
            }
        }
        return contentType;
    }




    public static getClipboardContentType(cb: (targets: ClipboardType) => void): boolean {

        var script = new Map([
            ["win32", "win32_get_clipboard_content_type.ps1"],
            ["linux", "linux_get_clipboard_content_type.sh"],
        ]);
        let ret = this.runScript(script, [], (data) => {
            console.log("getClipboardContentType", data);
            if (data === "no xclip") {
                vscode.window.showInformationMessage('You need to install xclip command first.');
                return;
            }
            cb(this.getClipboardType(data.split(/\r\n|\n|\r/)));
        });
        return ret;
    }





    public static pasteTextPlain(callback: (data: string) => void): boolean {
        var script = new Map([
            ["win32", "win32_get_clipboard_text_plain.ps1"],
            ["linux", "linux_get_clipboard_text_plain.sh"],
        ]);
        var ret = this.runScript(script, [], (data) => {
            callback(data);
        });
        return ret;
    }


    public static pasteTextHtml(callback: (data: string) => void): boolean {
        var script = new Map([
            ["win32", "win32_get_clipboard_text_html.ps1"],
            ["linux", "linux_get_clipboard_text_html.sh"],
        ]);
        var ret = this.runScript(script, [], (data) => {
            callback(data);
        });
        return ret;
    }

    /**
     * use applescript to save image from clipboard and get file path
     */
    public static saveClipboardImageToFileAndGetPath(imagePath: string, cb: (imagePath: string) => void): boolean {
        if (!imagePath) { return false; }

        var script = new Map([
            ["win32", "win32_save_clipboard_png.ps1"],
            ["linux", "linux_save_clipboard_png.sh"],
            ["darwin", "mac.applescript"],
        ]);
        let ret = this.runScript(script, [imagePath], (data) => {
            cb(data);
        });

        return ret;
    }


    /**
      * Run shell script.
      * @param script
      * @param parameters
      * @param callback
      */
    public static runScript(scripts: Map<string, string>, parameters: string[] = [], callback = (data: string) => { }): boolean {
        let platform = process.platform;
        if (typeof scripts.get(platform) === "undefined") {
            console.log(`Cannot found script for ${platform}`);
            return false;
        }
        const scriptPath = path.join(__dirname, Command.scriptBasePath + scripts.get(platform));
        let shell = "";
        let command = [];

        if (platform === 'win32') {
            // Windows
            command = [
                '-noprofile',
                '-noninteractive',
                '-nologo',
                '-sta',
                '-executionpolicy', 'unrestricted',
                '-windowstyle', 'hidden',
                '-file', scriptPath].concat(parameters);
            shell = 'powershell';
        } else if (platform === 'darwin') {
            // Mac
            shell = 'osascript';
            command = [scriptPath].concat(parameters);
        } else {
            // Linux
            shell = 'sh';
            command = [scriptPath].concat(parameters);
        }
        const runer = Command.runCommand(shell, command);
        runer.then(stdout => {
            if (callback) {
                callback(stdout.toString().trim());
            }
            // return stdout                 // return the command value
        }, err => {
            console.log(err);
            // throw err                     // throw again the error
        });
        return true;
    }


    /**
     * Run command and get stdout
     * @param shell
     * @param options
     */
    public static runCommand(shell: string, options: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            let stdout = "";
            let stderr = "";
            let process: ChildProcess = spawn(shell, options);
            process.stdout?.on("data", contents => {
                stdout += contents;
            });
            process.stderr?.on("data", contents => {
                stderr += contents;
            });
            process.on("error", reject).on("close", function (code) {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(stderr));
                }
            });
        });
    }
}