/**
 * Clipboard exporter for WeChat-compatible HTML.
 * @module clipboard-exporter
 */

import { convertMathForWechat, stripFormulaExportMetadata } from './math-exporter.js';

function extractBackgroundColor(styleString) {
  if (!styleString) return null;

  const bgColorMatch = styleString.match(/background-color:\s*([^;]+)/);
  if (bgColorMatch) return bgColorMatch[1].trim();

  const bgMatch = styleString.match(/background:\s*([#rgb][^;]+)/);
  if (bgMatch) {
    const bgValue = bgMatch[1].trim();
    if (bgValue.startsWith('#') || bgValue.startsWith('rgb')) return bgValue;
  }

  return null;
}

async function convertImageToBase64(imgElement, imageStore) {
  const src = imgElement.getAttribute('src');
  if (src.startsWith('data:')) return src;

  const imageId = imgElement.getAttribute('data-image-id');
  if (imageId && imageStore) {
    try {
      const blob = await imageStore.getImageBlob(imageId);
      if (blob) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (_error) {
      // fall through to fetch
    }
  }

  const response = await fetch(src, { mode: 'cors', cache: 'default' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function convertGridToTable(doc) {
  const imageGrids = doc.querySelectorAll('.image-grid');
  imageGrids.forEach((grid) => {
    const columns = parseInt(grid.getAttribute('data-columns'), 10) || 2;
    convertSingleGridToTable(doc, grid, columns);
  });
}

function convertSingleGridToTable(doc, grid, columns) {
  const wrappers = Array.from(grid.children);
  const table = doc.createElement('table');
  table.setAttribute('style', 'width: 100% !important; border-collapse: collapse !important; margin: 20px auto !important; table-layout: fixed !important; border: none !important;');

  const rows = Math.ceil(wrappers.length / columns);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const row = doc.createElement('tr');

    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const cell = doc.createElement('td');
      cell.setAttribute('style', `padding: 4px !important; vertical-align: top !important; width: ${100 / columns}% !important; border: none !important;`);

      const item = wrappers[rowIndex * columns + columnIndex];
      if (item) {
        const image = item.querySelector('img');
        if (image) {
          const nextImage = image.cloneNode(true);
          nextImage.setAttribute('style', 'max-width: calc(100% - 20px) !important; max-height: 340px !important; width: auto !important; height: auto !important; display: inline-block !important; margin: 0 auto !important; border-radius: 4px !important; object-fit: contain !important;');

          const wrapper = doc.createElement('div');
          wrapper.setAttribute('style', 'width: 100% !important; height: 360px !important; text-align: center !important; background-color: #f5f5f5 !important; border-radius: 4px !important; padding: 10px !important; box-sizing: border-box !important; overflow: hidden !important; display: table !important;');

          const inner = doc.createElement('div');
          inner.setAttribute('style', 'display: table-cell !important; vertical-align: middle !important; text-align: center !important;');
          inner.appendChild(nextImage);
          wrapper.appendChild(inner);
          cell.appendChild(wrapper);
        }
      }

      row.appendChild(cell);
    }

    table.appendChild(row);
  }

  grid.parentNode.replaceChild(table, grid);
}

function convertCodeBlocks(doc, styleConfig, codeTheme) {
  const blocks = doc.querySelectorAll('[data-code-block="true"]');
  const resolvedStyles = resolveCodeBlockExportStyles(styleConfig, codeTheme);

  blocks.forEach((block) => {
    const code = block.querySelector('.md-code-block-code');
    if (!code) return;

    const wrapper = doc.createElement('section');
    wrapper.setAttribute('style', resolvedStyles.wrapper);

    const codeNode = doc.createElement('code');
    codeNode.setAttribute('style', resolvedStyles.code);
    codeNode.innerHTML = toWechatCodeHTML(code.textContent || '');

    wrapper.appendChild(codeNode);
    block.parentNode.replaceChild(wrapper, block);
  });
}

function resolveCodeBlockExportStyles(styleConfig, codeTheme) {
  if (codeTheme) {
    return {
      wrapper: `margin: 24px 0 !important; padding: 16px !important; background: ${codeTheme.bg} !important; color: ${codeTheme.textColor} !important; overflow-x: auto !important; border: 1px solid ${codeTheme.borderColor} !important; border-radius: 10px !important; box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important; -webkit-box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important;`,
      code: `display: block !important; background: transparent !important; color: ${codeTheme.textColor} !important; font-family: "SF Mono", Consolas, Monaco, "Courier New", monospace !important; font-size: 14px !important; line-height: 1.7 !important; white-space: normal !important; word-break: break-word !important; tab-size: 2 !important;`
    };
  }

  const preStyle = styleConfig?.styles?.pre || '';
  const cleanCodeStyle = sanitizeThemeCodeStyle(styleConfig?.styles?.code || '');
  const preTextColor = extractStyleValue(preStyle, 'color');
  const codeHasColor = Boolean(extractStyleValue(cleanCodeStyle, 'color'));
  const textColorFallback = preTextColor && !codeHasColor ? `color: ${preTextColor} !important;` : '';
  const fontFamilyFallback = extractStyleValue(cleanCodeStyle, 'font-family')
    ? ''
    : 'font-family: "SF Mono", Consolas, Monaco, "Courier New", monospace !important;';
  const fontSizeFallback = extractStyleValue(cleanCodeStyle, 'font-size') ? '' : 'font-size: 14px !important;';
  const lineHeightFallback = extractStyleValue(cleanCodeStyle, 'line-height') ? '' : 'line-height: 1.7 !important;';

  return {
    wrapper: `margin: 24px 0 !important; padding: 16px !important; overflow-x: auto !important; ${preStyle}`,
    code: `display: block !important; background: transparent !important; white-space: normal !important; word-break: break-word !important; tab-size: 2 !important; ${fontFamilyFallback} ${fontSizeFallback} ${lineHeightFallback} ${textColorFallback} ${cleanCodeStyle}`
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

function escapeHtml(value) {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toWechatCodeHTML(codeText) {
  const normalized = (codeText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ');

  if (!normalized) return '&nbsp;';

  return escapeHtml(normalized)
    .split('\n')
    .map((line) => (line.length ? line.replace(/ /g, '&nbsp;') : '&nbsp;'))
    .join('<br>');
}

function flattenListItems(doc) {
  doc.querySelectorAll('li').forEach((item) => {
    const clone = item.cloneNode(true);
    replaceFormulaNodesWithPlainText(clone);
    const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    item.innerHTML = '';
    item.textContent = text;
  });
}

function normalizeBlockquotes(doc) {
  doc.querySelectorAll('blockquote').forEach((blockquote) => {
    let style = blockquote.getAttribute('style') || '';
    style = style.replace(/background(?:-color)?:\s*[^;]+;?/gi, '');
    style = style.replace(/color:\s*[^;]+;?/gi, '');
    style += '; background: rgba(0, 0, 0, 0.05) !important; color: rgba(0, 0, 0, 0.8) !important;';
    blockquote.setAttribute('style', style);
  });
}

function normalizeTablesForWechat(doc) {
  const wrappedTables = doc.querySelectorAll('.md-table-scroll > table');
  wrappedTables.forEach((table) => {
    const wrapper = table.parentElement;
    if (!wrapper || !wrapper.parentNode) return;
    wrapper.parentNode.insertBefore(table, wrapper);
    wrapper.remove();
  });

  doc.querySelectorAll('table').forEach((table) => {
    const tableStyle = table.getAttribute('style') || '';
    table.setAttribute(
      'style',
      `${tableStyle}; width: 100% !important; max-width: 100% !important; table-layout: fixed !important;`
    );
  });

  doc.querySelectorAll('th, td').forEach((cell) => {
    const cellStyle = cell.getAttribute('style') || '';
    cell.setAttribute(
      'style',
      `${cellStyle}; word-break: break-word; overflow-wrap: anywhere; white-space: normal;`
    );
  });
}

function wrapSectionIfNeeded(doc, styleConfig) {
  const containerBg = extractBackgroundColor(styleConfig.styles.container);
  if (!containerBg || containerBg === '#fff' || containerBg === '#ffffff') return;

  const section = doc.createElement('section');
  const containerStyle = styleConfig.styles.container;
  const paddingMatch = containerStyle.match(/padding:\s*([^;]+)/);
  const maxWidthMatch = containerStyle.match(/max-width:\s*([^;]+)/);

  section.setAttribute(
    'style',
    `background-color: ${containerBg}; padding: ${paddingMatch ? paddingMatch[1].trim() : '40px 20px'}; max-width: ${maxWidthMatch ? maxWidthMatch[1].trim() : '100%'}; margin: 0 auto; box-sizing: border-box; word-wrap: break-word;`
  );

  while (doc.body.firstChild) {
    section.appendChild(doc.body.firstChild);
  }

  doc.body.appendChild(section);
}

function buildClipboardPlainText(doc) {
  const clone = doc.body.cloneNode(true);

  replaceFormulaNodesWithPlainText(clone);

  clone.querySelectorAll('br').forEach((br) => {
    br.replaceWith('\n');
  });

  clone.querySelectorAll('p, div, section, pre, blockquote, li, h1, h2, h3, h4, h5, h6, tr').forEach((node) => {
    if (!node.textContent?.endsWith('\n')) {
      node.append('\n');
    }
  });

  return (clone.textContent || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function replaceFormulaNodesWithPlainText(root) {
  root.querySelectorAll('[data-formula-plain]').forEach((node) => {
    const formulaText = node.getAttribute('data-formula-plain') || '';
    node.replaceWith(root.ownerDocument.createTextNode(formulaText));
  });
}

export async function copyToWechat({ renderedHTML, styleConfig, imageStore, showToast, codeTheme }) {
  if (!renderedHTML) {
    showToast('没有内容可复制', 'error');
    return false;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(renderedHTML, 'text/html');

    convertGridToTable(doc);
    normalizeTablesForWechat(doc);

    const images = Array.from(doc.querySelectorAll('img'));
    if (images.length > 0) {
      showToast(`正在处理 ${images.length} 张图片...`, 'success');
      await Promise.all(images.map(async (img) => {
        try {
          const base64 = await convertImageToBase64(img, imageStore);
          img.setAttribute('src', base64);
        } catch (_error) {
          img.remove();
        }
      }));
    }

    await convertMathForWechat(doc);
    convertCodeBlocks(doc, styleConfig, codeTheme);
    flattenListItems(doc);
    normalizeBlockquotes(doc);
    wrapSectionIfNeeded(doc, styleConfig);

    const text = buildClipboardPlainText(doc);
    stripFormulaExportMetadata(doc.body);
    const html = doc.body.innerHTML;

    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' })
    });

    await navigator.clipboard.write([item]);
    showToast('复制成功', 'success');
    return true;
  } catch (error) {
    console.error('复制失败:', error);
    showToast('复制失败', 'error');
    return false;
  }
}
