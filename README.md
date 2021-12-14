fork from https://e.coding.net/godgodgame/tools/vscode-vditor.git

# vscode-vditor

基于[vditor](https://github.com/Vanessa219/vditor)开发的一个markdown编辑器插件

- [制品库](https://godgodgame.coding.net/public-artifacts/tools/vscode-vditor/packages)(非正式版可以在这里下载)
- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=zhepama.vscode-vditor)
- 我的另一个markdown插件: [vscode-milkdown](https://marketplace.visualstudio.com/items?itemName=zhepama.vscode-milkdown)

## 特性

* vditor编辑器的全部特征,并修复了些许bug
* ctrl+v 可以黏贴图片并下载到本地,可在配置设置否启用
* ctrl+alt+v 可以黏贴图片并下载到本地,一般是在编辑器下使用
* 没有计划添加图床功能,由于本人使用hexo写博客,现功能已满足

## 使用

如果想默认打开markdown使用vditor可以进行以下配置

```
"Vditor.openMode": "none",
"workbench.editorAssociations": {
    "*.md": "vscode-vditor.vditor"
},
```

## 联系

- zhepama@gmail.com

## License

MIT
