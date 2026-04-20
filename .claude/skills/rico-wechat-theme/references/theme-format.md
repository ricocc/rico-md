# WeChat Article Theme File Format

## File Naming Convention

Theme files are JavaScript ES modules stored in the `themes/` directory. File names use kebab-case with a descriptive key, e.g. `wechat-anthropic.js`, `wechat-elegant.js`, `wechat-nyt.js`.

## File Structure

Every theme file follows this exact structure:

```javascript
/**
 * Theme: [Theme Display Name]
 * Key: [theme-key]
 */

export const theme = {
  "name": "[Theme Display Name]",
  "styles": {
    "container": "CSS styles string...",
    "h1": "CSS styles string...",
    // ... other elements
  }
};
```

## Required Style Properties

Every theme MUST define styles for ALL of these elements:

| Key | Description |
|---|---|
| `container` | Main content wrapper. Always includes: max-width, margin, padding, font-family, font-size, line-height, color, background-color, word-wrap |
| `h1` - `h6` | Heading levels 1-6. Include: font-size, font-weight, color, line-height, margin, and optional decorative elements (borders, backgrounds, gradients) |
| `p` | Paragraphs. Include: margin, line-height, color, optional text-indent |
| `strong` | Bold text. Include: font-weight, color, optional background highlight |
| `em` | Italic text. Include: font-style, color |
| `a` | Links. Include: color, text-decoration, optional border-bottom |
| `ul` | Unordered lists. Include: margin, padding-left |
| `ol` | Ordered lists. Include: margin, padding-left |
| `li` | List items. Include: margin, line-height, color |
| `blockquote` | Quoted text. Include: margin, padding, background, border-left, color, line-height, optional font-style/border-radius |
| `code` | Inline code. Include: font-family, font-size, padding, background-color, color, border-radius |
| `pre` | Code blocks. Include: margin, padding, background-color, font-size, border-radius, overflow-x, line-height |
| `hr` | Horizontal rules. Include: margin, border styling, optional max-width |
| `img` | Images. Include: max-width, max-height, height, display, margin, border-radius, optional box-shadow |
| `table` | Tables. Include: width, margin, border-collapse, font-size |
| `th` | Table headers. Include: background, padding, text-align, border, font-weight, color |
| `td` | Table cells. Include: padding, border, color |
| `tr` | Table rows. Include: border styling |

## Style Extraction from WeChat Articles

When analyzing a WeChat article URL, extract these key properties:

### Container / Global
- `font-family` from body or rich_media_content
- `font-size` base (usually 15-17px)
- `line-height` (usually 1.6-2.0)
- `color` main text color
- `background-color` (usually #fff)
- `margin-left` / `margin-right` (often 8px)
- `max-width` (usually 620-740px)

### Paragraphs
- `font-size` (often 15-16px)
- `line-height` (often 1.6-2.2)
- `color`
- `margin` spacing
- `text-indent` (2em for Chinese articles with indentation)

### Bold Text
- `font-weight` (500-700)
- `color` accent color
- Optional: `background-color` highlight

### Headings
- `font-size` (h1: 22-42px, h2: 20-32px, h3: 18-24px)
- `font-weight`
- `color`
- Decorative elements: border-bottom, border-left, background gradients, text-align center

### Links
- `color` (often a brand accent color)
- `text-decoration` style
- `border-bottom` style

### Blockquotes
- `border-left` width and color
- `background-color`
- `padding`
- `font-style`

### Code Blocks
- `background-color` (dark theme like #2d2d2d or light like #f5f5f5)
- `color`
- `border-radius`
- `font-family` (monospace)

### Images
- `border-radius`
- `max-height` (commonly 600px)
- Optional `box-shadow`

## Theme Key Naming Convention

Use the format `wechat-[descriptor]` for keys. The descriptor should be:
- Lowercase, hyphenated
- Reflective of the style's character (e.g., `wechat-anthropic`, `wechat-elegant`, `wechat-tech`)

## Registration in index.js

After creating a theme file, add an import line to `themes/index.js`:

```javascript
import { theme as wechatXxx } from './wechat-xxx.js';
```

And add it to the STYLES export object:

```javascript
export const STYLES = {
  // ... existing themes
  'wechat-xxx': wechatXxx,
};
```
