import * as vscode from 'vscode';
import * as path from 'path';
import { ImageSaver } from './imagesaver';


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

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

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
				updateWebview();
			}
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'after':
					this.onAfter(document);
					return;
				case "save":
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
					this.onUpload(webviewPanel,document, e.files);
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

		const baseHref = path.dirname(
			webview.asWebviewUri(vscode.Uri.file(document.uri.fsPath)).toString()
		) + '/';
		return /* html */`
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8"> 
				<meta name="viewport" content="width=device-width, initial-scale=1.0"> 
				<meta http-equiv="X-UA-Compatible" content="ie=edge">
				<base href="${baseHref}" />

				<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vditor@3.8.7/dist/index.css" /> 
				<link href="${styleMainUri}" rel="stylesheet" />

				<title>Vditor</title>
			</head>
			<body>
				<div id="vditor"></div>
				<script src="https://cdn.jsdelivr.net/npm/vditor@3.8.7/dist/index.min.js"></script>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	private textEditTimer: NodeJS.Timeout | undefined;
	private async onInput(document: vscode.TextDocument, content: string) {
		this.textEditTimer && clearTimeout(this.textEditTimer);
		this.textEditTimer = setTimeout(() => {
			this.updateTextDocument(document, content);
		}, 300);
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
	private onAfter(document: vscode.TextDocument) {

	}

	private onUpload(webviewPanel: vscode.WebviewPanel,document: vscode.TextDocument, files: any[]) {
		var imageSaver = ImageSaver.getInstance();
		var result = files.map((f: any) => {
			return imageSaver.copyFile(f,document);
		});
		webviewPanel.webview.postMessage({
			type: 'uploaded',
			files: result,
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
