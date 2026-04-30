/**
 * Render pipeline.
 * @module render-pipeline
 */

export async function renderPipeline({ markdown, md, imageStore, styleConfig, codeTheme }) {
  if (!markdown.trim()) return '';

  const { preprocessMarkdown } = await import('./markdown-engine.js');
  const processedContent = preprocessMarkdown(markdown);

  let html = md.render(processedContent);

  if (imageStore) {
    html = await processImageProtocol(html, imageStore);
  }

  return applyInlineStyles(html, styleConfig, codeTheme);
}

async function processImageProtocol(html, imageStore) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const images = doc.querySelectorAll('img');

  for (const img of images) {
    const src = img.getAttribute('src');
    if (!src?.startsWith('img://')) continue;

    const imageId = src.replace('img://', '');

    try {
      const objectURL = await imageStore.getImage(imageId);
      if (objectURL) {
        img.setAttribute('src', objectURL);
        img.setAttribute('data-image-id', imageId);
      }
    } catch (_error) {
      img.setAttribute('alt', '图片加载失败');
    }
  }

  return doc.body.innerHTML;
}

function applyInlineStyles(html, styleConfig, codeTheme) {
  const style = styleConfig.styles;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  groupConsecutiveImages(doc);

  Object.keys(style).forEach((selector) => {
    if (selector === 'container' || selector === 'pre' || selector === 'code' || selector === 'pre code') return;

    const elements = doc.querySelectorAll(selector);
    elements.forEach((element) => {
      if (element.tagName === 'IMG' && element.closest('.image-grid')) return;
      appendStyleText(element, style[selector]);
    });
  });

  normalizeTableOverflow(doc);
  applyInlineCodeStyles(doc, style);
  applyStandalonePreStyles(doc, style);
  applyCodeBlockStyles(doc, style, codeTheme);

  const container = doc.createElement('div');
  container.setAttribute('style', style.container);
  container.innerHTML = doc.body.innerHTML;
  return container.outerHTML;
}

function appendStyleText(element, styleText) {
  if (!styleText) return;
  const currentStyle = element.getAttribute('style') || '';
  element.setAttribute('style', currentStyle ? `${currentStyle}; ${styleText}` : styleText);
}

function normalizeTableOverflow(doc) {
  const tables = Array.from(doc.querySelectorAll('table'));

  tables.forEach((table) => {
    if (table.closest('.md-table-scroll')) return;

    appendStyleText(table, 'max-width: 100%; width: max-content; min-width: 100%; table-layout: auto;margin-bottom:16px;');

    const parent = table.parentNode;
    if (!parent) return;

    const wrapper = doc.createElement('div');
    wrapper.className = 'md-table-scroll';
    wrapper.setAttribute(
      'style',
      'max-width: 100%; width: 100%; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch;margin-bottom:28px;'
    );

    parent.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

function applyInlineCodeStyles(doc, style) {
  if (!style.code) return;
  const inlineCodes = doc.querySelectorAll('code:not(.md-code-block-code)');
  inlineCodes.forEach((codeElement) => {
    if (codeElement.closest('pre')) return;
    appendStyleText(codeElement, style.code);
  });
}

function applyStandalonePreStyles(doc, style) {
  if (!style.pre) return;
  const standalonePre = doc.querySelectorAll('pre:not(.md-code-block-pre)');
  standalonePre.forEach((preElement) => {
    appendStyleText(preElement, style.pre);
  });
}

function applyCodeBlockStyles(doc, style, codeTheme) {
  const blocks = doc.querySelectorAll('[data-code-block="true"]');
  if (blocks.length === 0) return;

  const resolvedStyles = codeTheme
    ? buildCodeThemeStyles(codeTheme)
    : buildThemeCodeBlockStyles(style);

  blocks.forEach((block) => {
    const pre = block.querySelector('.md-code-block-pre');
    const code = block.querySelector('.md-code-block-code');

    block.setAttribute('style', resolvedStyles.block);

    if (pre) {
      pre.setAttribute('style', resolvedStyles.pre);
    }

    if (code) {
      code.setAttribute('style', resolvedStyles.code);
    }
  });
}

function buildCodeThemeStyles(codeTheme) {
  return {
    block: 'margin: 24px 0;',
    pre: `margin: 0; padding: 16px; overflow-x: auto; background: ${codeTheme.bg}; border: 1px solid ${codeTheme.borderColor}; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.12); -webkit-box-shadow: 0 2px 8px rgba(0,0,0,0.12);`,
    code: `display: block; margin: 0; background: transparent; color: ${codeTheme.textColor}; font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace; font-size: 14px; line-height: 1.7; white-space: pre; tab-size: 2;`
  };
}

function buildThemeCodeBlockStyles(style) {
  const preStyle = style.pre || '';
  const cleanCodeStyle = sanitizeThemeCodeStyle(style.code || '');
  const preTextColor = extractStyleValue(preStyle, 'color');
  const codeHasColor = Boolean(extractStyleValue(cleanCodeStyle, 'color'));
  const textColorFallback = preTextColor && !codeHasColor ? `color: ${preTextColor};` : '';
  const fontFamilyFallback = extractStyleValue(cleanCodeStyle, 'font-family')
    ? ''
    : "font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;";
  const fontSizeFallback = extractStyleValue(cleanCodeStyle, 'font-size') ? '' : 'font-size: 14px;';
  const lineHeightFallback = extractStyleValue(cleanCodeStyle, 'line-height') ? '' : 'line-height: 1.7;';

  return {
    block: 'margin: 24px 0;',
    pre: `margin: 0; padding: 16px; overflow-x: auto; ${preStyle}`,
    code: `display: block; margin: 0; background: transparent; white-space: pre; tab-size: 2; ${fontFamilyFallback} ${fontSizeFallback} ${lineHeightFallback} ${textColorFallback} ${cleanCodeStyle}`
  };
}

function sanitizeThemeCodeStyle(styleText) {
  if (!styleText) return '';
  return styleText.replace(
    /(^|;)\s*(padding(?:-[^:]+)?|background(?:-color)?|border(?:-[^:]+)?|border-radius|display|white-space)\s*:\s*[^;]+;?/gi,
    ';'
  );
}

function extractStyleValue(styleText, property) {
  if (!styleText || !property) return null;
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styleText.match(new RegExp(`${escapedProperty}\\s*:\\s*([^;]+)`, 'i'));
  return match ? match[1].trim() : null;
}

function groupConsecutiveImages(doc) {
  const body = doc.body;
  const children = Array.from(body.children);
  const imagesToProcess = [];

  children.forEach((child, index) => {
    if (child.tagName === 'P') {
      const images = child.querySelectorAll('img');
      if (images.length > 0) {
        if (images.length > 1) {
          imagesToProcess.push(...Array.from(images).map((img) => ({ element: child, img, index })));
        } else {
          imagesToProcess.push({ element: child, img: images[0], index });
        }
      }
    } else if (child.tagName === 'IMG') {
      imagesToProcess.push({ element: child, img: child, index });
    }
  });

  let currentGroup = [];
  const groups = [];

  imagesToProcess.forEach((item, idx) => {
    if (idx === 0) {
      currentGroup.push(item);
      return;
    }

    const previous = imagesToProcess[idx - 1];
    const isContinuous = item.index === previous.index || item.index - previous.index === 1;

    if (isContinuous) {
      currentGroup.push(item);
    } else {
      if (currentGroup.length > 0) groups.push([...currentGroup]);
      currentGroup = [item];
    }
  });

  if (currentGroup.length > 0) groups.push(currentGroup);

  groups.forEach((group) => {
    if (group.length < 2) return;

    const firstElement = group[0].element;
    const gridContainer = doc.createElement('div');
    const count = group.length;
    const columns = count === 2 ? 2 : count === 4 ? 2 : 3;

    gridContainer.className = 'image-grid';
    gridContainer.setAttribute('data-columns', String(columns));
    gridContainer.setAttribute(
      'style',
      `display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 8px; margin: 20px auto; max-width: 100%; align-items: start;`
    );

    group.forEach((item) => {
      const wrapper = doc.createElement('div');
      wrapper.setAttribute('style', 'width: 100%; height: auto; overflow: hidden;');

      const image = item.img.cloneNode(true);
      image.setAttribute('style', 'width: 100%; height: auto; display: block; border-radius: 8px;');
      wrapper.appendChild(image);
      gridContainer.appendChild(wrapper);
    });

    firstElement.parentNode.insertBefore(gridContainer, firstElement);

    const uniqueElements = new Set(group.map((item) => item.element));
    uniqueElements.forEach((element) => {
      if (element.parentNode) element.parentNode.removeChild(element);
    });
  });
}
