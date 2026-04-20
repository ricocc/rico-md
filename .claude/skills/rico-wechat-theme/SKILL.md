---
name: rico-wechat-theme
description: 从公众号文章链接中提取排版样式，生成可复用的公众号主题文件。当用户说"rico 制作公众号主题"、"rico 公众号主题"、或者提供公众号文章链接要求提取/制作主题时触发。也适用于用户想要分析公众号文章的排版风格、将某篇文章的样式转化为主题模板的场景。
---

# Rico 公众号主题制作器

从微信公众号文章中提取排版细节，生成符合项目格式的主题文件。

## 工作流程

### 第一步：获取文章链接

如果用户直接提供了公众号文章链接（`mp.weixin.qq.com` 格式），直接使用。如果没有，向用户索要。

### 第二步：读取文章内容

**方式一（优先）：用户直接提供文章 HTML 源码或包含源码的文件。** 如果用户已经把公众号文章的排版内容（HTML）放在文件里（如项目中的 `示例：xxx.txt`），直接读取该文件，从中提取 `js_content` 或 `rich_media_content` 区域内的样式信息。

**方式二：通过 web reader 读取。** 使用 `mcp__web_reader__webReader` 工具读取文章页面。注意：web reader 通常返回的是渲染后的文本/markdown，而非原始 HTML，因此大部分内联样式会丢失。如果 web reader 无法获取到足够的样式细节，向用户说明并请求：
- 方式 A：请用户在浏览器中打开文章，右键查看源代码，复制 `js_content` 区域的 HTML 粘贴过来
- 方式 B：请用户提供一个包含文章 HTML 源码的本地文件路径

**需要提取的排版要素：**

1. **全局样式**：font-family、font-size、line-height、color、background-color、margin（从 p 标签的 style 属性、span 的 textstyle 样式中提取）
2. **段落样式**：字号（通常在 span textstyle 的 font-size 中）、行高、颜色、margin-left/margin-right
3. **加粗文本**：font-weight（查找 font-weight: bold）、颜色、是否有背景高亮
4. **标题样式**：如果文章使用了 h1-h6 标签，提取其样式；如果没有标题标签，根据段落样式推导
5. **链接样式**：从 a 标签及其 span 中提取 color、text-decoration
6. **引用块**：如果存在 blockquote，提取边框、背景色、内边距
7. **代码块**：从 pre/code 区域提取背景色、字体、圆角
8. **图片**：从 img 标签提取圆角、宽度、边距等

**关键提取策略：** 微信公众号文章的样式主要存储在 `<p style="...">` 和 `<span textstyle="" style="font-size: 16px; ...">` 的内联 style 属性中。核心是找出：
- 正文的 font-size（最常见值，如 15px、16px、17px）
- 正文的 color
- 正文的 line-height
- margin-left / margin-right 的值
- font-family（通常在 span 的 style 中，或在文末的样式块中）
- 加粗文本的 font-weight 和 color
- 链接的颜色

### 第三步：分析并生成主题

基于提取的样式信息，参照 `references/theme-format.md` 中定义的格式，生成一个完整的主题 JavaScript 对象。主题需要覆盖所有必需的样式属性（container、h1-h6、p、strong、em、a、ul、ol、li、blockquote、code、pre、hr、img、table、th、td、tr）。

对于文章中没有明确体现的元素（如 h1-h6、table 等），根据已提取的配色和排版风格合理推导补充，保持主题的一致性。

### 第四步：生成主题介绍

用中文撰写一段简洁的主题介绍（50-100字），描述这个主题的视觉特征和适用场景。格式如下：

```
主题名称：[名称]
主题简介：[描述]
主色调：[#hex]
适用场景：[场景描述]
风格关键词：[3-5个关键词]
```

### 第五步：提供 5 个选项供用户选择

基于分析结果，为用户生成 5 组不同的主题名和文件名组合。展示格式：

```
请选择一个主题（输入编号 1-5）：

1. 🎨 主题名：[名称] | 文件名：wechat-[key].js
2. 🎨 主题名：[名称] | 文件名：wechat-[key].js
3. 🎨 主题名：[名称] | 文件名：wechat-[key].js
4. 🎨 主题名：[名称] | 文件名：wechat-[key].js
5. 🎨 主题名：[名称] | 文件名：wechat-[key].js
```

5 个选项的命名思路应各有侧重：
- 提取品牌/作者特征的命名
- 描述视觉风格的命名
- 描述情感调性的命名
- 描述适用场景的命名
- 创意/隐喻式命名

### 第六步：确认并输出

用户选择后，用选定的名称和文件名生成最终的主题文件。

输出内容包含：
1. **主题文件内容**：完整的 JS 文件代码，格式参照现有主题文件（如 `wechat-anthropic.js`）
2. **文件保存位置**：提示用户将文件保存到项目的 `themes/` 目录
3. **注册提示**：提醒用户在 `index.js` 中添加 import 和 STYLES 条目

### 输出主题文件格式

严格按照以下格式输出：

```javascript
/**
 * Theme: [用户选择的主题名]
 * Key: [对应的 key]
 */

export const theme = {
  "name": "[主题名]",
  "styles": {
    "container": "...",
    "h1": "...",
    // 所有必需属性
  }
};
```

## 注意事项

- 所有 CSS 值中的颜色使用 `!important` 标记以确保在微信环境中生效
- `container` 的 `max-width` 一般在 620-740px 之间
- 图片 `max-height` 一般设为 `600px !important`
- 代码块（pre）通常使用深色背景，行内代码（code）使用浅色背景
- 确保文字与背景之间有足够的对比度
- 参考文章中提取的实际数值，不要使用与原文风格差异过大的默认值
