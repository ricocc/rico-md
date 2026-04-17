# AGENTS.md

本文件用于约束 AI 代码代理（如 Codex / Claude）在本仓库中的行为，确保改动与当前实现一致。

## 项目定位

Rico MD 是一个面向微信公众号排版的纯前端 Markdown 编辑器。

- 无构建流程，基于静态页面 + ES Modules
- 入口页：`index.html`
- 独立关于页：`about.html`
- 主逻辑：`assets/scripts/main.js`

## 当前版本关键事实（请以此为准）

1. 自动保存为固定 `5 秒` 防抖（不是 800ms，也不是可配置项）
2. 顶部导航包含：主题 / 代码 / 设置 / 关于
3. 代码块显示项已归入“代码”面板：
   - 显示代码语言
   - 显示复制按钮
   - 显示 macOS 装饰
4. 删除文档走确认弹窗流程；删除最后一篇后会自动新建空白文档
5. About 页面与样式已拆分：`about.html` + `assets/styles/about.css`
6. 图片链路为：压缩 + IndexedDB + `img://` 协议 + 复制时转 Base64

## 关键不变量（必须保持）

- 删除流程结束后必须满足：
  - `documents.length >= 1`
  - `activeDocumentId` 指向有效文档
- 弹窗初始状态必须隐藏：`deleteConfirm.show === false`
- 偏好存储键保持兼容（不要随意改名）：
  - `currentStyle`
  - `markdownInput`
  - `documents`
  - `activeDocumentId`
  - `codeBlockSettings`

## 代码结构速览

- `assets/scripts/main.js`：应用状态、文档管理、保存、交互入口
- `assets/scripts/core/`：Markdown 渲染、粘贴处理、图片存储与压缩
- `assets/scripts/export/clipboard-exporter.js`：复制到公众号相关处理
- `assets/scripts/storage/preferences.js`：本地持久化与防抖保存
- `assets/scripts/ui/`：主题、代码主题、面板、Toast
- `assets/styles/themes/`：正文主题定义
- `assets/scripts/ui/code-themes.js`：代码块主题定义

## 开发约束

- 保持纯前端运行方式，不引入额外构建工具
- 尽量做最小改动，避免无关重构
- 新增配置时优先考虑向后兼容
- 涉及存储/删除逻辑时必须覆盖空列表与无 active 的边界
- 保留公众号复制兼容链路（内联样式、图片 Base64、结构转换）

## 本地验证清单（改动后至少自测）

1. 输入后约 5 秒触发自动保存，刷新后内容可恢复
2. 单文档删除后自动补出空白文档，不出现左侧空列表
3. 多文档删除时 active 切换合理，内容不丢
4. “代码”面板三项显示开关生效
5. About 页面可打开，图片资源加载正常

## 运行方式

```bash
python -m http.server 8080
# 打开 http://localhost:8080
```
