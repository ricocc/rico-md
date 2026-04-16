/**
 * 应用入口 - 创建 Vue 应用，组装所有模块
 * @module main
 */

import { ImageStore } from './core/image-store.js';
import { ImageCompressor } from './core/image-compressor.js';
import { createMarkdownEngine } from './core/markdown-engine.js';
import { createTurndownService, createPasteHandler, isMarkdown, isIDEFormattedHTML } from './core/paste-handler.js';
import { renderPipeline } from './core/render-pipeline.js';
import { copyToWechat } from './export/clipboard-exporter.js';
import { getCategorizedThemes, getStyle, getStyleName, isRecommended, getStarredStyles, toggleStarStyle } from './ui/theme-manager.js';
import { getCodeTheme, getCodeThemeList, DEFAULT_CODE_THEME } from './ui/code-themes.js';
import { createToast } from './ui/toast.js';
import { createPanelManager } from './ui/panel-manager.js';
import { loadPreferences, savePreferences, debounceSaveContent } from './storage/preferences.js';
import { STYLES } from '../styles/themes/index.js';

const { createApp, ref, watch, nextTick, onMounted } = window.Vue;

// ── 状态 ──
const markdownInput = ref('');
const renderedContent = ref('');
const currentStyle = ref('wechat-default');
const starredStyles = ref([]);
const currentCodeTheme = ref(DEFAULT_CODE_THEME);
const previewMode = ref('desktop'); // 'desktop' | 'mobile'
const isDraggingOver = ref(false);
const copySuccess = ref(false);

// ── 面板 & Toast ──
const activePanel = ref(null);
const toastState = ref({ show: false, message: '', type: 'success' });
const sidebarOpen = ref(false);

// ── 统计 ──
const wordCount = ref(0);
const charCount = ref(0);
const readTime = ref(0);
const lastUpdateTime = ref('--:--:--');

// 面板宽度状态
const editorWidth = ref(null);  // 编辑器宽度 (percentage)
const rightPanelWidth = ref(null);  // 右侧面板宽度 (px)

const panelManager = createPanelManager(() => { activePanel.value = panelManager.getActivePanel(); });

// ── 分割线拖拽功能 ──
let resizeState = {
  handle: null,
  startX: 0,
  startEditorWidth: 0,
  startRightWidth: 0,
  type: null // 'editor-preview' | 'preview-right'
};

function initResizeHandles() {
  document.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.resize-handle');
    if (!handle) return;
    
    const type = handle.dataset.handle;
    if (!type) return;
    
    resizeState.handle = handle;
    resizeState.startX = e.clientX;
    resizeState.type = type;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    // 记录初始宽度
    const editorPanel = document.querySelector('.editor-panel');
    const rightPanel = document.querySelector('.right-panel');
    
    if (type === 'editor-preview') {
      resizeState.startEditorWidth = editorPanel?.offsetWidth || 0;
    } else if (type === 'preview-right' && rightPanel) {
      resizeState.startRightWidth = rightPanel.offsetWidth;
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!resizeState.handle) return;
    
    const delta = e.clientX - resizeState.startX;
    const editorPanel = document.querySelector('.editor-panel');
    const rightPanel = document.querySelector('.right-panel');
    const mainArea = document.querySelector('.main-area');
    
    if (!mainArea) return;
    
    const mainWidth = mainArea.offsetWidth;
    
    if (resizeState.type === 'editor-preview' && editorPanel) {
      const newWidth = resizeState.startEditorWidth + delta;
      const minWidth = 200;
      const maxWidth = mainWidth * 0.6;
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      editorWidth.value = (clampedWidth / mainWidth * 100).toFixed(2);
    } else if (resizeState.type === 'preview-right' && rightPanel) {
      const newWidth = resizeState.startRightWidth + delta;
      const minWidth = 280;
      const maxWidth = 500;
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      rightPanelWidth.value = clampedWidth;
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (resizeState.handle) {
      resizeState.handle.classList.remove('dragging');
      resizeState.handle = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}
const toast = createToast(() => { toastState.value = toast.getState(); });

// ── 服务实例 ──
let md = null;
let imageStore = null;
let imageCompressor = null;
let turndownService = null;
let syncScrollEnabled = ref(true);

// ── 分类主题列表 ──
const categorizedThemes = ref(getCategorizedThemes());
const codeThemeList = getCodeThemeList();

function updateStats() {
  const text = markdownInput.value;
  if (!text) { wordCount.value = 0; charCount.value = 0; readTime.value = 0; return; }

  // 字符数
  charCount.value = text.length;

  // 中文字数 + 英文词数
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const englishWords = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ')
    .split(/\s+/).filter(w => w.length > 0).length;
  const total = chineseChars + englishWords;

  wordCount.value = total;
  readTime.value = Math.max(1, Math.ceil(total / 300));

  // 更新时间戳
  const now = new Date();
  lastUpdateTime.value = now.toLocaleTimeString('zh-CN', { hour12: false });
}

// ── 渲染 ──
async function renderMarkdown() {
  if (!markdownInput.value.trim()) {
    renderedContent.value = '';
    return;
  }
  if (!md) return;

  const styleConfig = STYLES[currentStyle.value];
  if (!styleConfig) return;

  try {
    renderedContent.value = await renderPipeline({
      markdown: markdownInput.value,
      md,
      imageStore,
      styleConfig,
      codeTheme: getCodeTheme(currentCodeTheme.value)
    });
  } catch (error) {
    console.error('渲染失败:', error);
  }
}

// ── 图片上传 ──
async function handleImageUpload(file, textarea) {
  if (!file.type.startsWith('image/')) {
    toast.show('请上传图片文件', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    toast.show('图片大小不能超过 10MB', 'error');
    return;
  }

  const imageName = file.name.replace(/\.[^/.]+$/, '') || '图片';
  const originalSize = file.size;

  try {
    toast.show('正在压缩图片...', 'success');

    const compressedBlob = await imageCompressor.compress(file);
    const compressedSize = compressedBlob.size;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(0);

    const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await imageStore.saveImage(imageId, compressedBlob, {
      name: imageName,
      originalName: file.name,
      originalSize,
      compressedSize,
      compressionRatio,
      mimeType: compressedBlob.type || file.type
    });

    const markdownImage = `![${imageName}](img://${imageId})`;

    if (textarea) {
      const currentPos = textarea.selectionStart;
      const before = markdownInput.value.substring(0, currentPos);
      const after = markdownInput.value.substring(currentPos);
      markdownInput.value = before + markdownImage + after;

      nextTick(() => {
        const newPos = currentPos + markdownImage.length;
        textarea.selectionStart = textarea.selectionEnd = newPos;
        textarea.focus();
      });
    } else {
      markdownInput.value += '\n' + markdownImage;
    }

    if (compressionRatio > 10) {
      toast.show(`已保存 (${ImageCompressor.formatSize(originalSize)} → ${ImageCompressor.formatSize(compressedSize)})`, 'success');
    } else {
      toast.show(`已保存 (${ImageCompressor.formatSize(compressedSize)})`, 'success');
    }
  } catch (error) {
    console.error('图片处理失败:', error);
    toast.show('图片处理失败: ' + error.message, 'error');
  }
}

// ── 粘贴 ──
let pasteHandler = null;

function initPasteHandler() {
  turndownService = createTurndownService();
  pasteHandler = createPasteHandler({
    turndownService,
    handleImageUpload,
    showToast: (msg, type) => toast.show(msg, type),
    getInput: () => markdownInput.value,
    setInput: (val) => { markdownInput.value = val; },
    nextTick
  });
}

async function onPaste(event) {
  if (pasteHandler) {
    await pasteHandler(event);
  }
}

// ── 拖拽 ──
function handleDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  isDraggingOver.value = false;

  const files = event.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    if (file.type.startsWith('image/')) {
      handleImageUpload(file, event.target);
    } else {
      toast.show('只支持拖拽图片文件', 'error');
    }
  }
}

function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer.dropEffect = 'copy';
  isDraggingOver.value = true;
}

function handleDragEnter(event) {
  event.preventDefault();
  isDraggingOver.value = true;
}

function handleDragLeave(event) {
  event.preventDefault();
  if (event.target.classList.contains('markdown-input')) {
    isDraggingOver.value = false;
  }
}

// ── 文件导入 ──
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => { markdownInput.value = e.target.result; };
  reader.onerror = () => { toast.show('文件读取失败', 'error'); };
  reader.readAsText(file);
  event.target.value = '';
}

// ── 导出 ──
function exportMarkdown() {
  const blob = new Blob([markdownInput.value], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'article.md';
  a.click();
  URL.revokeObjectURL(url);
  toast.show('已导出 Markdown', 'success');
}

function exportHTML() {
  const blob = new Blob([renderedContent.value], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'article.html';
  a.click();
  URL.revokeObjectURL(url);
  toast.show('已导出 HTML', 'success');
}

// ── 复制到公众号 ──
async function doCopy() {
  const styleConfig = STYLES[currentStyle.value];
  const success = await copyToWechat({
    renderedHTML: renderedContent.value,
    styleConfig,
    imageStore,
    showToast: (msg, type) => toast.show(msg, type)
  });
  if (success) {
    copySuccess.value = true;
    setTimeout(() => { copySuccess.value = false; }, 2000);
  }
}

// ── 复制到 X (Twitter) ──
function copyToTwitter() {
  if (!renderedContent.value) return;
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(renderedContent.value, 'text/html');
  const text = doc.body.textContent || '';
  
  navigator.clipboard.writeText(text).then(() => {
    toast.show('已复制纯文本，可粘贴到 X', 'success');
  }).catch(() => {
    toast.show('复制失败', 'error');
  });
}

// ── 主题 ──
function selectTheme(key) {
  currentStyle.value = key;
  // 不自动收起面板
}

function toggleStar(key) {
  toggleStarStyle(key);
  starredStyles.value = getStarredStyles();
  categorizedThemes.value = getCategorizedThemes();
}

function selectCodeTheme(key) {
  currentCodeTheme.value = key;
  try { localStorage.setItem('currentCodeTheme', key); } catch (_e) {}
  renderMarkdown();
}

// ── 快捷键 ──
function handleKeydown(event) {
  const isMod = event.ctrlKey || event.metaKey;

  if (isMod && event.key === 's') {
    event.preventDefault();
    savePreferences(currentStyle.value, markdownInput.value);
    toast.show('已保存', 'success');
    return;
  }

  if (isMod && event.key === 'b') {
    event.preventDefault();
    wrapSelection('**', '**');
    return;
  }

  if (isMod && event.key === 'i') {
    event.preventDefault();
    wrapSelection('*', '*');
    return;
  }

  if (isMod && event.key === 'k') {
    event.preventDefault();
    wrapSelection('[', '](url)');
    return;
  }

  if (event.key === 'Tab') {
    event.preventDefault();
    const textarea = event.target;
    if (textarea.tagName === 'TEXTAREA') {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      markdownInput.value = markdownInput.value.substring(0, start) + '  ' + markdownInput.value.substring(end);
      nextTick(() => { textarea.selectionStart = textarea.selectionEnd = start + 2; });
    }
  }
}

function wrapSelection(before, after) {
  const textarea = document.querySelector('.markdown-input');
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = markdownInput.value.substring(start, end);
  const newText = before + (selected || '文本') + after;

  markdownInput.value = markdownInput.value.substring(0, start) + newText + markdownInput.value.substring(end);

  nextTick(() => {
    if (selected) {
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + selected.length;
    } else {
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + 2;
    }
    textarea.focus();
  });
}

// ── 同步滚动 ──
let _syncLock = false;

function setupSyncScroll() {
  const editor = document.querySelector('.markdown-input');
  const preview = document.querySelector('.preview-content');
  if (!editor || !preview) return;

  const sync = (source, target) => {
    if (_syncLock || !syncScrollEnabled.value) return;
    _syncLock = true;

    const ratio = source.scrollTop / (source.scrollHeight - source.clientHeight || 1);
    target.scrollTop = ratio * (target.scrollHeight - target.clientHeight);

    requestAnimationFrame(() => { _syncLock = false; });
  };

  editor.addEventListener('scroll', () => sync(editor, preview));
  preview.addEventListener('scroll', () => sync(preview, editor));
}

// ── 默认示例 ──
function loadDefaultExample() {
  markdownInput.value = `![](https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=1200&h=400&fit=crop)

# 公众号 Markdown 编辑器

欢迎使用这款专为**微信公众号**设计的 Markdown 编辑器！

## 🎯 核心功能

### 1. 智能图片处理

![](https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=800&h=500&fit=crop)

- **粘贴即用**：支持从任何地方复制粘贴图片（截图、浏览器、文件管理器）
- **自动压缩**：图片自动压缩，平均压缩 50%-80%
- **本地存储**：使用 IndexedDB 持久化，刷新不丢失
- **编辑流畅**：编辑器中使用短链接，告别卡顿

### 2. 多图排版展示

支持朋友圈式的多图网格布局，2-3 列自动排版：

![](https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=400&fit=crop)

![](https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=400&fit=crop)

![](https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&h=400&fit=crop)

### 3. 13 种精美样式

1. **经典公众号系列**：默认、技术、优雅、深度阅读
2. **传统媒体系列**：杂志、纽约时报、金融时报、Jony Ive
3. **现代数字系列**：Wired、Medium、Apple、Claude、AI Coder

### 4. 一键复制

点击「复制到公众号」按钮，直接粘贴到公众号后台，格式完美保留！

## 💻 代码示例

\`\`\`javascript
// 图片自动压缩并存储到 IndexedDB
const compressedBlob = await imageCompressor.compress(file);
await imageStore.saveImage(imageId, compressedBlob);

// 编辑器中插入短链接
const markdown = \`![图片](img::\${imageId})\`;
\`\`\`

## 📖 引用样式

> 这是一段引用文字，展示编辑器的引用样式效果。
>
> 不同的样式主题会有不同的引用样式，试试切换样式看看效果！

## 📊 表格支持

| 功能 | 支持情况 | 说明 |
|------|---------|------|
| 图片粘贴 | ✅ | 100% 成功率 |
| 刷新保留 | ✅ | IndexedDB 存储 |
| 样式主题 | ✅ | 13 种精选样式 |
| 代码高亮 | ✅ | 多语言支持 |

---

**💡 提示**：

- 试着切换不同的样式主题，体验各种风格的排版效果
- 粘贴图片试试智能压缩功能
- 刷新页面看看内容是否保留

**🌟 开源项目**：如果觉得有用，欢迎访问 [GitHub 仓库](https://github.com/ricocc/rico-md) 给个 Star！
`;
}

// ── 创建应用 ──
const app = createApp({
  setup() {
    // Watchers
    watch(markdownInput, () => {
      renderMarkdown();
      updateStats();
      debounceSaveContent(markdownInput.value);
    });

    watch(currentStyle, () => {
      renderMarkdown();
      savePreferences(currentStyle.value, markdownInput.value);
    });

    // 初始化
    onMounted(async () => {
      // 加载偏好
      starredStyles.value = getStarredStyles();
      const prefs = loadPreferences();
      currentStyle.value = prefs.currentStyle;

      // 初始化分割线拖拽
      initResizeHandles();

      // 代码主题
      try {
        const savedCodeTheme = localStorage.getItem('currentCodeTheme');
        if (savedCodeTheme && getCodeTheme(savedCodeTheme)) {
          currentCodeTheme.value = savedCodeTheme;
        }
      } catch (_e) {}

      // 初始化图片存储
      imageStore = new ImageStore();
      try { await imageStore.init(); } catch (e) { console.error('ImageStore 初始化失败:', e); }

      imageCompressor = new ImageCompressor({ maxWidth: 1920, maxHeight: 1920, quality: 0.85 });

      // 初始化 Markdown 引擎
      md = createMarkdownEngine();

      // 初始化粘贴处理
      initPasteHandler();

      // 加载内容
      if (prefs.content) {
        markdownInput.value = prefs.content;
      } else {
        loadDefaultExample();
      }

      // 初始渲染
      renderMarkdown();

      // 同步滚动
      nextTick(() => setupSyncScroll());
    });

    return {
      // 状态
      markdownInput,
      renderedContent,
      currentStyle,
      starredStyles,
      currentCodeTheme,
      previewMode,
      isDraggingOver,
      copySuccess,
      activePanel,
      toastState,
      syncScrollEnabled,
      sidebarOpen,
      wordCount,
      charCount,
      readTime,
      lastUpdateTime,
      // 面板宽度
      editorWidth,
      rightPanelWidth,
      // 主题
      categorizedThemes,
      codeThemeList,
      STYLES,
      // 方法
      renderMarkdown,
      doCopy,
      copyToTwitter,
      onPaste,
      handleDrop,
      handleDragOver,
      handleDragEnter,
      handleDragLeave,
      handleFileUpload,
      exportMarkdown,
      exportHTML,
      selectTheme,
      toggleStar,
      selectCodeTheme,
      handleKeydown,
      getStyleName,
      isRecommended,
      togglePanel: (name) => panelManager.toggle(name),
      clearEditor: () => { markdownInput.value = ''; },
    };
  }
});

app.mount('#app');
