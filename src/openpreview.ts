import * as vscode from 'vscode';
import { VditorConfig } from './config';
import { VditorEditorProvider } from './vditorEditorProvider';

export class AutoOpenPreview {

    public static alreadyOpenedFirstMarkdown = false;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static close_other_editor_command_id: string = "workbench.action.closeEditorsInOtherGroups";
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static markdown_preview_command_id: string = "markdown.showPreviewToSide";

    public static openPreview() {
        if(VditorConfig.openMode === "none")
        {
            return;
        }

        vscode.commands.executeCommand(AutoOpenPreview.close_other_editor_command_id)
            .then(() => {

                switch (VditorConfig.openMode) {
                    case "markdown_preview":
                        {
                            vscode.commands.executeCommand(AutoOpenPreview.markdown_preview_command_id);
                            break;
                        }
                    case "vditor_beside":
                        {
                            vscode.commands.executeCommand(
                                'vscode.openWith',
                                vscode.window.activeTextEditor?.document.uri,
                                VditorEditorProvider.viewType,
                                vscode.ViewColumn.Beside,
                            );
                            break;
                        }
                }

            })
            .then(() => { }, (e) => console.error(e));
    }

    public static active() {
        //注册打开文档后触发事件
        vscode.workspace.onDidOpenTextDocument((doc) => {
            if (doc && doc.languageId === "markdown") {
                AutoOpenPreview.openPreview();
            }
        });

        //为已经激活的编辑器打开preview
        //检查是否有激活的texteditor,没有的话则注册激活事件
        if (vscode.window.activeTextEditor) {
            AutoOpenPreview.previewFirstMarkdown();
        } else {
            vscode.window.onDidChangeActiveTextEditor(() => {
                AutoOpenPreview.previewFirstMarkdown();
            });
        }
    }


    public static previewFirstMarkdown() {
        if (AutoOpenPreview.alreadyOpenedFirstMarkdown) {
            return;
        }
        let editor = vscode.window.activeTextEditor;
        if (editor) {
            let doc = editor.document;
            if (doc && doc.languageId === "markdown") {
                AutoOpenPreview.openPreview();
                AutoOpenPreview.alreadyOpenedFirstMarkdown = true;
            }
        }
    }




}