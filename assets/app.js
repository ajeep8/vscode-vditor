// @ts-check

//import Vditor from 'vditor';

// Script run within the webview itself.
(function (global) {
    // Get a reference to the VS Code webview api.
    // We use this API to post messages back to our extension.
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    const langs = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "en_US": {
            refresh: "refresh",
            copyMarkdown: 'Copy Markdown',
            copyHtml: 'Copy HTML',
            sourceCode: "Source Code"
        },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "zh_CN": {
            refresh: "重载",
            copyMarkdown: '复制 Markdown',
            copyHtml: '复制 HTML',
            sourceCode: "查看源代码"
        },
    };

    //获取当前浏览器语言
    const lang = navigator.language.replace('-', '_');

    //多语言
    function t(/** @type {string} */ msg) {
        let l = lang;
        if (!langs[l]) {
            l = 'en_US';
        };
        return langs[l][msg];
    }


    //icon使用https://icons.getbootstrap.com/
    const toolbar = [
        { name: 'emoji', tipPosition: 'e' },
        { name: 'headings', tipPosition: 'e' },
        { name: 'bold', tipPosition: 'e' },
        { name: 'italic', tipPosition: 'e' },
        { name: 'strike', tipPosition: 'e' },
        { name: 'link', tipPosition: 'e' },
        '|',
        { name: 'list', tipPosition: 'e' },
        { name: 'ordered-list', tipPosition: 'e' },
        { name: 'check', tipPosition: 'e' },
        { name: 'outdent', tipPosition: 'e' },
        { name: 'indent', tipPosition: 'e' },
        '|',
        { name: 'quote', tipPosition: 'e' },
        { name: 'line', tipPosition: 'e' },
        { name: 'code', tipPosition: 'e' },
        { name: 'inline-code', tipPosition: 'e' },
        { name: 'insert-before', tipPosition: 'e' },
        { name: 'insert-after', tipPosition: 'e' },
        '|',
        { name: 'upload', tipPosition: 'e' },
        { name: 'table', tipPosition: 'e' },
        '|',
        { name: 'undo', tipPosition: 'e' },
        { name: 'redo', tipPosition: 'e' },
        {
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>',
            name: "refresh",
            tip: t('refresh'),
            tipPosition: "e",
            click() {
                vscode.postMessage({
                    type: 'refresh'
                });
            },
        },
        '|',
        {
            name: 'sourceCode',
            tip: t('sourceCode'),
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-layout-split" viewBox="0 0 16 16"><path d="M0 3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3zm8.5-1v12H14a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H8.5zm-1 0H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h5.5V2z"/></svg>',
            click() {
                vscode.postMessage({
                    type: 'sourceCode'
                });
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
        let $ct = document.querySelector('[data-type="content-theme"]');
        $ct.nextElementSibling.addEventListener('click', (e) => {
            //@ts-ignore
            if ((e.target).tagName !== 'BUTTON') { return; }
            //@ts-ignore
            let type = (e.target).dataset.type;
            if (type.search('dark') === -1) {
                global.vditor.setTheme('classic');
            } else {
                global.vditor.setTheme("dark");
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
        };
    }
    //保存选项
    function saveOptions() {
        let vditorOptions = {
            theme: global.vditor.vditor.options.theme,
            contentTheme: global.vditor.vditor.options.preview.theme.current,
            codeTheme: global.vditor.vditor.options.preview.hljs.style,
            editMode: global.vditor.vditor.currentMode,
        };
        vscode.postMessage({
            type: 'config',
            options: vditorOptions,
        });
    }
    //监听选项改变事件
    function listenVditorOptions() {
        function save(/** @type {Event} */e) {
            //@ts-ignore
            if ((e.target).tagName !== 'BUTTON') { return; }
            //间隔一下因为是先设置然后再获取..否则只是获取的是当前的配置
            setTimeout(() => {
                saveOptions();
            }, 300);
        }
        document.querySelector('[data-type="content-theme"]').nextElementSibling.addEventListener('click', (e) => {
            save(e);
        });
        document.querySelector('[data-type="code-theme"]').nextElementSibling.addEventListener('click', (e) => {
            save(e);
        });
        document.querySelector('[data-type="edit-mode"]').nextElementSibling.addEventListener('click', (e) => {
            save(e);
        });
    }


    //添加保存图片出发事件
    function listenContextMenuEvents() {

        //ctrl+alt+v
        document.addEventListener('keydown', (event) => {
            const keyName = event.key;
            if (keyName === 'Control' || keyName === 'Alt') {
                return;
            }
            if (event.ctrlKey && event.altKey && keyName === "v") {
                navigator.clipboard.read().then(items => {
                    for (let i = 0; i < items.length; i++) {
                        var types = items[i].types; 
                        if(types.length === 1 && types[0] === "text/plain")
                        {
                            vscode.postMessage({ type: 'paste'});
                            continue;
                        }
                        for (let j = 0; j < types.length; j++) {
                            if (types[j] === "text/html") {
                                items[i].getType("text/html").then((blob) => {
                                    blob.text().then(html => { 
                                        //检查是否有图片,有图片再处理
                                        if (/<img[^>]+src="([^">]+)/g.test(html)) {
                                            vscode.postMessage({ type: 'pasteContent', content: html });
                                        }
                                    });
                                });
                            }  
                        }
                    }
                }); 
            }
        }, false);


        const target = document.querySelector('.vditor-content');
        //paste事件捕捉设置useCapture = true,为捕获阶段
        target.addEventListener('paste', (event) => {
            //如果不用自动保存图片,则不用处理,这个得在客户端处理,如果只在服务端的话,就会造成事件不能传播
            if (global.vditorOptions.autoSaveImage === false) {
                return;
            }
            //@ts-ignore
            let paste = event.clipboardData.getData("text/html");
            //检查是否有图片,有图片再处理
            var hasImage = false;
            if (/<img.*?src="(.*?)"[^\>]+>/g.test(paste)) {
                hasImage = true;
            }
            if (hasImage === true) {
                vscode.postMessage({ type: 'pasteContent', content: paste });
                event.preventDefault();
                event.stopImmediatePropagation();//阻止事件在捕获阶段还是冒泡阶段。
                // event.stopPropagation();//阻止事件在冒泡阶段。
            }
        }, true);

        //冒泡阶段,剪切后也触发保存
        target.addEventListener('cut', (event) => {
            vscode.postMessage({ type: 'input', content: global.vditor.getValue() });
        }, false);
    }


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

    function debounce(fn, wait = 1) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.call(this, ...args), wait);
        };
    }



    const initVditor = (language) => {
        // @ts-ignore
        global.vditor = new Vditor('vditor', {
            lang: language,
            theme: global.vditorOptions.theme || 'classic',
            icon: 'material',
            mode: global.vditorOptions.editMode || 'ir',
            toolbar: toolbar,
            toolbarConfig: {
                pin: true,
            },
            cache: {
                enable: false
            },
            preview: {
                theme: {
                    current: global.vditorOptions.contentTheme || 'light-autonum',
                    list: {
                        "light-autonum": "Light-AutoNumber",
                        "light": "Light",
                        "dark": "Dark",
                        "wechat": "WeChat",
                        "ant-design": "Ant",
                        "github-dark": "github-dark",
                        "github-light": "github-light"
                    },
                    path: global.vditorOptions.themePath || `https://cdn.jsdelivr.net/npm/vditor${global.vditorOptions.version}/dist/css/content-theme`
                },
                hljs: {
                    style: global.vditorOptions.codeTheme || 'github',
                    lineNumber: false,
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
                handler(files) {
                    vscode.postMessage({
                        type: 'upload',
                        files: files.map((f) => { return f.path; }),
                    });
                },
            },
            after() {
                fixDarkTheme();
                fixCut();
                fixLinkClick();
                listenVditorOptions();
                listenContextMenuEvents();
                vscode.postMessage({ type: 'ready' });
            },
            input(/** @type {string} */ text) {
                debounce(() => {
                    vscode.postMessage({ type: 'input', content: text });
                }, 200)();
            },
            focus(/** @type {string} */ value) {
                // vscode.postMessage({ type: 'focus', content: value });
            },
            blur(/** @type {string} */ value) {
                //  vscode.postMessage({ type: 'blur', content: value });
            },
            esc(/** @type {string} */ value) {
                //   vscode.postMessage({ type: 'esc', content: value });
            },
            ctrlEnter(/** @type {string} */ value) {
                //   vscode.postMessage({ type: 'ctrlEnter', content: value });
            },
            select(/** @type {string} */ value) {
                //  vscode.postMessage({ type: 'select', content: value });
            },
        });
    };

    //移除vscode的特性样式
    var htmlElement = document.querySelector("html");
    htmlElement.removeAttribute("style");

    global.setLang = (language) => {
        global.vditor.destroy();
        initVditor(language);
    };

    // Handle messages sent from the extension to the webview
    global.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'update':
                const text = message.text;
                // Update our webview's content
                updateContent(text);
                break;
            case 'uploaded':
                message.files.forEach((f) => {
                    uploaded(f);
                });
                break;
            case "pasted":
                uploaded(message.content);
                break;
        }
    });

    initVditor(lang);

}).call(this, window);
