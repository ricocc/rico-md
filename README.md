# Rico MD - 公众号 Markdown 编辑器

一个面向微信公众号写作与排版的纯前端 Markdown 编辑器，支持实时预览、代码块主题、图片本地持久化与一键复制富文本。

## 仓库地址：

- https://github.com/ricocc/rico-md/


## 在线地址

- https://md.uiineed.com

## 核心能力

### 1. 编辑与预览
- 左侧 Markdown 编辑，右侧实时预览。
- 支持常用编辑快捷操作（标题、加粗、斜体、引用、代码块、分割线、表格等）。
- 支持桌面/手机预览模式切换。

### 2. 文档管理
- 支持多文档创建、切换、复制、删除、搜索。
- 删除操作使用确认弹窗，避免误删。
- 删除最后一篇文档后会自动创建一篇空白文档，保证始终有可编辑文档。
- 文档与当前激活状态会持久化到 `localStorage`。

### 3. 自动保存与保存状态
- 输入后采用固定 `5 秒` 防抖自动保存。
- 状态栏显示 `保存中 / 已保存 / 保存失败` 与最后保存时间。
- 保留显式保存快捷键：`Ctrl/Cmd + S`。

### 4. 主题与代码面板
- 内置多套公众号排版主题（当前 18 套）。
- 代码面板支持独立代码主题（当前 16 套）。
- 代码块显示设置已集中到“代码”面板：
  - 显示代码语言
  - 显示复制按钮
  - 显示 macOS 装饰

### 5. 图片处理（本地优先）
- 支持粘贴、拖拽、工具栏上传图片。
- 使用 Canvas 压缩（保留 GIF/SVG 策略）后写入 IndexedDB。
- 编辑器内使用 `img://` 短链接，避免大段 Base64 影响输入性能。
- 渲染时从 IndexedDB 读取并替换为可预览 URL。
- 复制到公众号时自动转换为 Base64，提升粘贴兼容性。

### 6. 导出与复制
- 一键复制到公众号（富文本 HTML）。
- 支持复制纯文本。
- 支持导出 `.md` 与 `.html`。

### 7. About 页面
- 顶部导航新增“关于”，跳转到独立页面 `about.html`。
- 页面包含作者介绍、标签、知识库链接与联系方式二维码展示。

## 技术栈

- Vue 3（CDN）
- markdown-it
- highlight.js
- turndown
- IndexedDB
- Canvas API
- 原生 ES Modules + 纯 CSS

## 本地运行

```bash
# 进入项目目录
cd rico-md

# 启动本地静态服务
python -m http.server 8080

# 访问
# http://localhost:8080
```

也可使用仓库内脚本：

```bash
./start.sh
```

## 项目结构（当前）

```text
rico-md/
├── index.html
├── about.html
├── README.md
├── LICENSE
├── AGENTS.md
├── GEMINI.md
├── start.sh
├── assets/
│   ├── images/
│   │   ├── favicon.png
│   │   ├── icon.svg
│   │   ├── logo.png
│   │   ├── wechat.png
│   │   ├── wx.jpg
│   │   └── zanshangma.jpg
│   ├── scripts/
│   │   ├── main.js
│   │   ├── core/
│   │   │   ├── image-compressor.js
│   │   │   ├── image-store.js
│   │   │   ├── markdown-engine.js
│   │   │   ├── paste-handler.js
│   │   │   └── render-pipeline.js
│   │   ├── export/
│   │   │   └── clipboard-exporter.js
│   │   ├── storage/
│   │   │   └── preferences.js
│   │   └── ui/
│   │       ├── code-themes.js
│   │       ├── panel-manager.js
│   │       ├── theme-manager.js
│   │       └── toast.js
│   └── styles/
│       ├── about.css
│       ├── base.css
│       ├── editor.css
│       ├── panel.css
│       └── themes/
│           ├── index.js
│           └── *.js（主题定义）
└── docs/
    ├── CHANGELOG.md
    ├── CLAUDE.md
    ├── CONTRIBUTING.md
    ├── PRD.md
    ├── PRD-2.md
    ├── PROGRESS.md
    └── DESIGN/
        └── reflct-co-DESIGN.md
```

## 兼容性说明

- 这是一个纯前端静态项目，无构建步骤。
- 需要现代浏览器支持：ES Modules、Clipboard API、Fetch、IndexedDB。
- 针对公众号复制场景做了结构与样式兼容处理（如代码块与图片复制策略）。


## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 如何贡献
1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

### 添加新样式
1. 在 `styles/themes/` 中添加新的主题配置文件
2. 在 `styles/themes/index.js` 中注册主题
3. 确保包含所有必需的元素样式
4. 测试各种 Markdown 元素的渲染效果

## 👨‍💻 作者

**Rico**
- 🌐 个人网站：[https://ricoui.com](https://ricoui.com)
- 💻 GitHub：[@ricocc](https://github.com/ricocc)

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。

你可以自由地：
- ✅ 商业使用
- ✅ 修改
- ✅ 分发
- ✅ 私有使用

## 🙏 致谢

- 感谢原项目 [huasheng_editor](https://github.com/alchaincyf/huasheng_editor) 的作者花生


## 📊 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ricocc/rico-md&type=Date)](https://star-history.com/#ricocc/rico-md&Date)

---

<div align="center">
  Made with ❤️ by <a href="https://ricoui.com">Rico</a>
  <br>
  如果觉得有用，请给个 ⭐️ Star 支持一下！
</div>