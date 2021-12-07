import * as vscode from 'vscode';

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
export class VditorConfig {

    private static _rules: Array<ConfigRule> = new Array<ConfigRule>();

    public static get rules(): Array<ConfigRule> {
        this._rules = [];
        let config = vscode.workspace.getConfiguration('Vditor');
        let rules = config.rules;
        for (var i = 0; i < rules.length; i++) {
            let rule = rules[i];
            this._rules.push(new ConfigRule(rule.regex, rule.options, rule.replace));
        } 
        return this._rules;
    }

    public static get folderPathFromConfig(): string {
        let config = vscode.workspace.getConfiguration('Vditor');
        return config.imgSavePath;
    }
  
    public static get encodePathConfig(): string {
        let config = vscode.workspace.getConfiguration('Vditor');
        return config.encodePath;
    }
    
    public static get vditorVersion(): string {
        let config = vscode.workspace.getConfiguration('Vditor');
        return config.vditorVersion;
    }

    public static get autoDownloadToLocal(): boolean {
        let config = vscode.workspace.getConfiguration('Vditor');
        return config.autoDownloadToLocal;
    }
}
