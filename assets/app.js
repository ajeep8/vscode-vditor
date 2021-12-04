// @ts-check

//import Vditor from 'vditor';

// Script run within the webview itself.
(function (global) {
    // Get a reference to the VS Code webview api.
    // We use this API to post messages back to our extension.
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    const langs = {
        en_US: {
            save: 'Save',
            copyMarkdown: 'Copy Markdown',
            copyHtml: 'Copy HTML',
            resetConfig: 'Reset config',
            resetConfirm: "Are you sure to reset the markdown-editor's config?",
        },
        ja_JP: {
            save: '保存する',
        },
        ko_KR: {
            save: '저장',
        },
        zh_CN: {
            save: '保存',
            copyMarkdown: '复制 Markdown',
            copyHtml: '复制 HTML',
            resetConfig: '重置配置',
            resetConfirm: '确定要重置 markdown-editor 的配置么?',
        },
    };

    const lang = (() => {
        let l = navigator.language.replace('-', '_');
        if (!langs[l]) {
            l = 'zh_CN';
        };
        return l;
    })();

    function t(msg) {
        return (langs[lang] && langs[lang][msg]) || langs.en_US[msg];
    }



    const toolbar = [
        'emoji',
        'headings',
        'bold',
        'italic',
        'strike',
        'link',
        '|',
        'list',
        'ordered-list',
        'check',
        'outdent',
        'indent',
        '|',
        'quote',
        'line',
        'code',
        'inline-code',
        'insert-before',
        'insert-after',
        '|',
        'upload',
        'table',
        '|',
        'undo',
        'redo',
        '|',
        { name: 'edit-mode', tipPosition: 'e', },
        {
            name: 'more',
            tipPosition: 'e',
            toolbar: [
                'both',
                'code-theme',
                'content-theme',
                'outline',
                'preview',
                {
                    name: 'copy-markdown',
                    icon: t('copyMarkdown'),
                    async click() {
                        try {
                            await navigator.clipboard.writeText(global.vditor.getValue());
                            vscode.postMessage({
                                command: 'info',
                                content: 'Copy Markdown successfully!',
                            });
                        } catch (error) {
                            vscode.postMessage({
                                command: 'error',
                                content: `Copy Markdown failed! ${error.message}`,
                            });
                        }
                    },
                },
                {
                    name: 'copy-html',
                    icon: t('copyHtml'),
                    async click() {
                        try {
                            await navigator.clipboard.writeText(global.vditor.getHTML());
                            vscode.postMessage({
                                command: 'info',
                                content: 'Copy HTML successfully!',
                            });
                        } catch (error) {
                            vscode.postMessage({
                                command: 'error',
                                content: `Copy HTML failed! ${error.message}`,
                            });
                        }
                    },
                },
                'devtools',
                'info',
                'help',
            ],
        },
    ];







    /** error:
     We don't execute document.execCommand() this time, because it is called recursively.
    (anonymous) @ main.js:32449
    (anonymous) @ main.js:842
    (anonymous) @ host.js:27
    see: https://github.com/nwjs/nw.js/issues/3403 */
    function fixCut() {
        let _exec = document.execCommand.bind(document);
        document.execCommand = (cmd, ...args) => {
            if (cmd === 'delete') {
                setTimeout(() => {
                    return _exec(cmd, ...args);
                });
            } else {
                return _exec(cmd, ...args);
            }
        };
    }

    const initVditor = (language) => {
        // @ts-ignore
        global.vditor = new Vditor('vditor', {
            lang: language,
            width: '100%',
            height: '100%',
            minHeight: '100%',
            mode: 'ir',
            toolbar: toolbar,
            toolbarConfig: {
                pin: true,
            },
            preview: {
                theme: {
                    current: 'light',
                },
                markdown: {
                    toc: true,
                    mark: true,
                    footnotes: true,
                    autoSpace: true,
                },
                math: {
                    engine: 'KaTeX',
                },
            },
            tab: '\t',
            upload: {
                accept: 'image/*,.mp3, .wav, .rar',
                url: '/api/upload/editor',
                linkToImgUrl: '/api/upload/fetch',
                filename(name) {
                    return name.replace(/[^(a-zA-Z0-9\u4e00-\u9fa5\.)]/g, '').
                        replace(/[\?\\/:|<>\*\[\]\(\)\$%\{\}@~]/g, '').
                        replace('/\\s/g', '');
                },
                handler(files) {
                    console.log(files);
                    vscode.postMessage({
                        type: 'upload',
                        files: files.map((f)=>{return f.path;}),
                    });
                    return null;
                },
            },
            after() {   
                fixCut();
                vscode.postMessage({ type: 'after' });
            },
            input(/** @type {string} */ value) {
                vscode.postMessage({ type: 'input', content: value });
            },
            focus(/** @type {string} */ value) {
                vscode.postMessage({ type: 'focus', content: value });
            },
            blur(/** @type {string} */ value) {
                vscode.postMessage({ type: 'blur', content: value });
            },
            esc(/** @type {string} */ value) {
                vscode.postMessage({ type: 'esc', content: value });
            },
            ctrlEnter(/** @type {string} */ value) {
                vscode.postMessage({ type: 'ctrlEnter', content: value });
            },
            select(/** @type {string} */ value) {
                vscode.postMessage({ type: 'select', content: value });
            },
        });
    };
    initVditor('zh_CN');

    global.setLang = (language) => {
        global.vditor.destroy();
        initVditor(language);
    };

    // Webviews are normally torn down when not visible and re-created when they become visible again.
    // State lets us save information across these re-loads
    const state = vscode.getState();
    if (state) {
        updateContent(state.text);
    }

    // Handle messages sent from the extension to the webview
    global.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'update':
                const text = message.text;

                // Update our webview's content
                updateContent(text);

                // Then persist state information.
                // This state is returned in the call to `vscode.getState` below when a webview is reloaded.
                vscode.setState({ text });

                break;
            case 'uploaded':
                console.log(message.files);
                message.files.forEach((f) => {
                    uploaded(f);
                });

                break;
        }
    });

    /**
   * Render the document in the webview.
   */
    function updateContent(/** @type {string} */ text) {
        global.vditor.setValue(text);
    }

    /**
   * 上传完文件
   */
    function uploaded(/** @type {string} */file) {
        global.vditor.insertValue(file);
    }
}).call(this, window);
