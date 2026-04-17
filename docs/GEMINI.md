# GEMINI.md

本文件用于 Gemini 类代理在本仓库中的协作上下文说明。目标：减少误判、避免改旧架构、提高改动成功率。

## 项目现状

Rico MD 为微信公众号 Markdown 编辑器，当前为模块化静态前端项目。

- 页面：`index.html`（编辑器）、`about.html`（关于页）
- 脚本入口：`assets/scripts/main.js`
- 样式入口：`assets/styles/base.css`、`editor.css`、`panel.css`、`about.css`
- 主题定义：`assets/styles/themes/*.js`

## 当前版本行为基线

1. 自动保存间隔固定为 `5 秒`（防抖）
2. 设置面板仅保留通用项（如同步滚动、快捷键提示）
3. 代码块显示设置在“代码”面板内，与代码主题并列：
   - 显示代码语言
   - 显示复制按钮
   - 显示 macOS 装饰
4. 文档删除使用确认弹窗
5. 删除最后一篇文档后自动创建一篇空白文档
6. 顶部导航包含“关于”，跳转 `about.html`

## 存储与兼容要求

请保持以下 localStorage 键兼容：

- `currentStyle`
- `markdownInput`
- `documents`
- `activeDocumentId`
- `codeBlockSettings`

不要无迁移地改键名或改数据结构。

## 图片系统（不可破坏）

现有方案：

- 图片压缩：`assets/scripts/core/image-compressor.js`
- 图片存储：`assets/scripts/core/image-store.js`（IndexedDB）
- 编辑器内引用：`img://` 协议
- 复制到公众号时转 Base64：`assets/scripts/export/clipboard-exporter.js`

任何改动都要确保“可预览 + 可复制 + 刷新后不丢图”。

## 改动优先级原则

1. 优先修复正确性（报错、状态不一致、数据丢失）
2. 再做交互和可用性优化
3. 最后做样式润色

## 必测场景

1. 首次进入、刷新恢复、切换文档
2. 单文档删除与多文档删除
3. 自动保存状态显示与恢复
4. 图片粘贴/拖拽/复制到公众号
5. About 页桌面与移动端显示

## 本地运行

```bash
python -m http.server 8080
# 访问 http://localhost:8080
```
