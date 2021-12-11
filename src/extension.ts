// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { VditorEditorProvider } from './vditorEditorProvider';
import { ImageSaver } from './imageSaver';
import { AutoOpenPreview } from './openpreview';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	context.subscriptions.push(vscode.commands.registerCommand("vscode-vditor.open", (uri?: vscode.Uri) => {
		if (!vscode.window.activeTextEditor) {
			if(!uri)
			{
				return;
			}
			vscode.commands.executeCommand(
				'vscode.openWith',
				uri,
				"default",
				vscode.ViewColumn.Beside,
			);
		}
		else {
			let url = uri;
			if (!url) {
				url = vscode.window.activeTextEditor?.document.uri;
			}
			if (!url) {
				console.error('Cannot get url');
				return;
			}
			vscode.commands.executeCommand(
				'vscode.openWith',
				url,
				VditorEditorProvider.viewType,
				vscode.ViewColumn.Beside,
			);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('vscode-vditor.paste', () => {
		let instance = ImageSaver.getInstance();
		instance.pasteText();
	}));

	context.subscriptions.push(VditorEditorProvider.register(context));
	AutoOpenPreview.active();
}

// this method is called when your extension is deactivated
export function deactivate() {
}
