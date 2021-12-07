import * as vscode from 'vscode';
import * as path from 'path';
import { ImageSaver } from './imageSaver1';
import { VditorConfig } from './config';

export class VditorEditorProvider implements vscode.CustomTextEditorProvider {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new VditorEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(
			VditorEditorProvider.viewType,
			provider,
			{ webviewOptions: { retainContextWhenHidden: true } });
		return providerRegistration;
	}

	public static readonly viewType = 'vscode-vdito.vdito';
	public static keyVditorOptions = 'vditor.options';
	constructor(
		private readonly context: vscode.ExtensionContext
	) {

		context.globalState.setKeysForSync([VditorEditorProvider.keyVditorOptions]);
	}

	/**
	 * Called when our custom editor is opened.
	 * 
	 * 
	 */
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);

		function updateWebview() {
			webviewPanel.webview.postMessage({
				type: 'update',
				text: document.getText(),
			});
		}

		// Hook up event handlers so that we can synchronize the webview with the text document.
		//
		// The text document acts as our model, so we have to sync change in the document to our
		// editor and sync changes in the editor back to the document.
		// 
		// Remember that a single text document can also be shared between multiple custom
		// editors (this happens for example when you split a custom editor)
		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString()) {

				if (e.contentChanges.length === 0) {
					//没有内容改变返回
					return;
				}
				if (this.saveing === true) {
					//如果是保存中,且有内容改变
					this.saveing = false;
					return;
				}
				updateWebview();
			}
		});

		const saveDocumentSubscription = vscode.workspace.onDidSaveTextDocument(e => {
			if (e.uri.toString() === document.uri.toString()) {
				//暂时没什么需要
			}
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
			saveDocumentSubscription.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'ready':
					this.onReady(document);
					return;
				case "save":
					this.onSave(document, e.content);
					return;
				case 'input':
					this.onInput(document, e.content);
					return;
				case 'focus':
					this.onFocus(document, e.content);
					return;
				case 'blur':
					this.onBlur(document, e.content);
					return;
				case 'esc':
					this.onEsc(document, e.content);
					return;
				case 'ctrlEnter':
					this.onCtrlEnter(document, e.content);
					return;
				case 'select':
					this.onSelect(document, e.content);
					return;
				case 'upload':
					this.onUpload(webviewPanel, document, e.files);
					return;
				case 'paste':
					this.onPaste(webviewPanel, document);
					return;
				case 'refresh':
					updateWebview();
					return;
				case 'sourceCode':
					{
						vscode.commands.executeCommand('vscode.openWith', document.uri, "default", vscode.ViewColumn.Beside);
					}
					return;
				case 'link':
					{
						let url = e.href;
						if (!/^http/.test(url)) {
							url = path.resolve(document.uri.fsPath, '..', url);
						}
						vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
					}
					return;
				case "config":
					{
						this.context.globalState.update(VditorEditorProvider.keyVditorOptions, e.options);
					}
					return;
			}
		});

		updateWebview();
	}



	/**
	 * Get the static html used for the editor webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
		// Local path to script and css for the webview
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'assets', 'app.js'));

		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'assets', 'vditor.css'));

		//用于图片显示
		const baseHref = path.dirname(
			webview.asWebviewUri(vscode.Uri.file(document.uri.fsPath)).toString()
		) + '/';


		var options = this.context.globalState.get(VditorEditorProvider.keyVditorOptions);
		var version= VditorConfig.vditorVersion;

		return /* html */`
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8"> 
				<meta name="viewport" content="width=device-width, initial-scale=1.0"> 
				<meta http-equiv="X-UA-Compatible" content="ie=edge">
				<base href="${baseHref}" />
				<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vditor${version}/dist/index.css" /> 
				<link href="${styleMainUri}" rel="stylesheet" />
				<title>Vditor</title>
			</head>
			<body>
				<div id="vditor"></div>
				<script>
				(function (global) {
					global.vditorOptions = ${JSON.stringify(options)} || {};
				}).call(this, window);
				</script>
				<script src="https://cdn.jsdelivr.net/npm/vditor${version}/dist/index.min.js"></script>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	private saveing: boolean = false;
	private onSave(document: vscode.TextDocument, content: string) {
		this.saveing = true;
		this.updateTextDocument(document, content);
	}

	private onInput(document: vscode.TextDocument, content: string) {
		this.onSave(document, content);
	}

	private onSelect(document: vscode.TextDocument, content: any) {
		vscode.window.activeTextEditor?.edit(builder => {
			builder.replace(vscode.window.activeTextEditor!.selection, content);
		});
	}
	private onCtrlEnter(document: vscode.TextDocument, content: any) {

	}
	private onEsc(document: vscode.TextDocument, content: any) {

	}
	private onBlur(document: vscode.TextDocument, content: any) {

	}
	private onFocus(document: vscode.TextDocument, content: any) {

	}
	private onReady(document: vscode.TextDocument) {

	}

	private onUpload(webviewPanel: vscode.WebviewPanel, document: vscode.TextDocument, files: any[]) {
		var imageSaver = ImageSaver.getInstance();
		var result = files.map((f: any) => {
			return imageSaver.copyFile(document, f);
		});
		webviewPanel.webview.postMessage({
			type: 'uploaded',
			files: result,
		});
	}

	private onPaste(webviewPanel: vscode.WebviewPanel, document: vscode.TextDocument) {
		var imageSaver = ImageSaver.getInstance();
		imageSaver.pasteTextStr(document, (data) => {
			webviewPanel.webview.postMessage({
				type: 'pasted',
				content: data,
			});
		});
	}

	/**
 * Write out the json to a given document.
 */
	private updateTextDocument(document: vscode.TextDocument, content: any) {
		const edit = new vscode.WorkspaceEdit();
		// Just replace the entire document every time for this example extension.
		// A more complete extension should compute minimal edits instead.
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			content);
		return vscode.workspace.applyEdit(edit);
	}
}
