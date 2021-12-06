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
            copyMarkdown: 'Copy Markdown',
            copyHtml: 'Copy HTML',
        },
        ja_JP: {
        },
        ko_KR: {
        },
        zh_CN: {
            save: '保存',
            copyMarkdown: '复制 Markdown',
            copyHtml: '复制 HTML',
            sourceCode: "查看源代码"
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
        {
            name: 'sourceCode',
            tip: t('sourceCode'),
            icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path></svg>',
            click() {
                vscode.postMessage({
                    type: 'sourceCode'
                })
            },
        },
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
                                type: 'info',
                                content: 'Copy Markdown successfully!',
                            });
                        } catch (error) {
                            vscode.postMessage({
                                type: 'error',
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
                                type: 'info',
                                content: 'Copy HTML successfully!',
                            });
                        } catch (error) {
                            vscode.postMessage({
                                type: 'error',
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


    // 切换 content-theme 时自动修改 vditor theme
    function fixDarkTheme() {
        let $ct = document.querySelector('[data-type="content-theme"]')
        $ct.nextElementSibling.addEventListener('click', (e) => {

            //@ts-ignore
            if ((e.target).tagName !== 'BUTTON') return;
            //@ts-ignore
            let type = (e.target).dataset.type;
            if (type === 'dark') {
                global.vditor.setTheme("dark");
            } else {
                global.vditor.setTheme('classic');
            }
        });
    }



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

    //修复链接不能点击打开
    function fixLinkClick() {
        const openLink = (url) => {
            vscode.postMessage({ type: 'link', href: url });
        };
        document.addEventListener('click', e => {
            //@ts-ignore
            if (e.target.tagName === 'A') {
                //@ts-ignore
                openLink(e.target.href);
            }
        });
        window.open = (url) => {
            openLink(url);
            return window;
        }
    }

    //保存一些简单的配置
    function saveVditorOptions() {
        let x = document.querySelectorAll('.vditor-toolbar button[data-mode], .vditor-toolbar button[data-type]')
        var i;
        for (i = 0; i < x.length; i++) {
            x[i].addEventListener('click', e => {
                //间隔一下因为是先设置然后再获取..否则只是获取的是当前的配置
                setTimeout(() => {
                    let vditorOptions = {
                        theme: global.vditor.vditor.options.theme,
                        mode: global.vditor.vditor.currentMode,
                        previewtheme: global.vditor.vditor.options.preview.theme.current
                    };
                    vscode.postMessage({
                        type: 'config',
                        options: vditorOptions,
                    });
                }, 300);

            });
        }

    }

    var  textEditTimer;

    const initVditor = (language) => {

        // @ts-ignore
        global.vditor = new Vditor('vditor', {
            lang: language,
            width: '100%',
            height: window.innerHeight + 100,
            minHeight: '100%',
            theme: global.vditorOptions.theme || 'classic',
            mode: global.vditorOptions.mode || 'ir',
            toolbar: toolbar,
            toolbarConfig: {
                pin: true,
            },
            preview: {
                theme: {
                    current: global.vditorOptions.previewtheme || 'light',
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
                        files: files.map((f) => { return f.path; }),
                    });
                    return null;
                },
            },
            after() {
                fixDarkTheme();
                fixCut();
                fixLinkClick();
                saveVditorOptions();
                vscode.postMessage({ type: 'ready' });
            },
            input(/** @type {string} */ value) {
                //避免更新过较频繁或更新代价较高
                textEditTimer && clearTimeout(textEditTimer);
                textEditTimer = setTimeout(() => { 
                    vscode.postMessage({ type: 'input', content: value });
                }, 300); 
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

    document.addEventListener('keydown', (event) => {
        const keyName = event.key;

        if (keyName === 'Control' || keyName === 'Alt') {
            // do not alert when only Control key is pressed.
            return;
        }

        if (event.ctrlKey && event.altKey && keyName === "v") {
            vscode.postMessage({ type: 'paste' });
        }
    }, false);

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
            case "pasted":
                global.vditor.insertValue(message.content);
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
