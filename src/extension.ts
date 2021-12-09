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

	context.subscriptions.push(vscode.commands.registerCommand(AutoOpenPreview.vditor_preview_command_id, () => {
		vscode.commands.executeCommand(
			'vscode.openWith',
			vscode.window.activeTextEditor?.document.uri,
			VditorEditorProvider.viewType,
			vscode.ViewColumn.Beside,
		);
	}));

	context.subscriptions.push(vscode.commands.registerCommand(AutoOpenPreview.vditor_paste_command_id, () => {
		let instance = ImageSaver.getInstance();
		instance.pasteText();
	}));

	context.subscriptions.push(VditorEditorProvider.register(context));
	AutoOpenPreview.active();
}

// this method is called when your extension is deactivated
export function deactivate() {
}
