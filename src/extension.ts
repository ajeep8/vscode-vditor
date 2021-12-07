// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { VditorEditorProvider } from './vditorEditorProvider1';
import {ImageSaver} from './imageSaver1';
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-vditor" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	context.subscriptions.push(vscode.commands.registerCommand('vscode-vditor.open', () => {
		vscode.commands.executeCommand(
			'vscode.openWith',
			vscode.window.activeTextEditor?.document.uri,
			VditorEditorProvider.viewType,
			vscode.ViewColumn.Beside,
		  );
	}));

	context.subscriptions.push(vscode.commands.registerCommand('vscode-vditor.paste', () => {
		let instance = ImageSaver.getInstance(); 
		instance.pasteText();
	}));

	context.subscriptions.push(VditorEditorProvider.register(context));

}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log('Congratulations, your extension "vscode-vditor" is now deactivate!');
}
