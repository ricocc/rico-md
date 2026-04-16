/**
 * Clipboard exporter for WeChat-compatible HTML.
 * @module clipboard-exporter
 */

function getCodeSettings(codeBlockSettings) {
  return {
    showLanguageLabel: codeBlockSettings?.showLanguageLabel !== false,
    showCopyButton: codeBlockSettings?.showCopyButton !== false,
    showMacDecorations: codeBlockSettings?.showMacDecorations !== false
  };
}

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

function convertCodeBlocks(doc, codeTheme, codeBlockSettings) {
  const settings = getCodeSettings(codeBlockSettings);
  const blocks = doc.querySelectorAll('[data-code-block="true"]');

  blocks.forEach((block) => {
    const code = block.querySelector('.md-code-block-code');
    if (!code) return;

    const language = (block.getAttribute('data-code-language') || '').trim();
    const wrapper = doc.createElement('div');
    wrapper.setAttribute(
      'style',
      `margin: 24px 0; border-radius: 8px; overflow: hidden; background: ${codeTheme.bg}; border: 1px solid ${codeTheme.borderColor};`
    );

    const showLanguage = settings.showLanguageLabel && Boolean(language);
    const showDecorations = settings.showMacDecorations;
    const showHeader = showLanguage || showDecorations;

    if (showHeader) {
      const header = doc.createElement('div');
      header.setAttribute(
        'style',
        `padding: 10px 12px; background: ${codeTheme.headerBg}; border-bottom: 1px solid ${codeTheme.borderColor}; font-size: 11px; line-height: 1.4; color: ${codeTheme.textColor};`
      );

      if (showDecorations) {
        const dots = doc.createElement('span');
        dots.textContent = '● ● ●';
        dots.setAttribute('style', 'display: inline-block; letter-spacing: 4px; margin-right: 10px; color: #ff5f56;');
        header.appendChild(dots);
      }

      if (showLanguage) {
        const label = doc.createElement('span');
        label.textContent = language.toUpperCase();
        label.setAttribute('style', `font-weight: 600; letter-spacing: 0.04em; color: ${codeTheme.textColor}; opacity: 0.72;`);
        header.appendChild(label);
      }

      wrapper.appendChild(header);
    }

    const pre = doc.createElement('pre');
    pre.setAttribute(
      'style',
      `margin: 0; padding: 16px; background: ${codeTheme.bg}; color: ${codeTheme.textColor}; overflow-x: auto; white-space: pre; font-family: "SF Mono", Consolas, Monaco, "Courier New", monospace; font-size: 14px; line-height: 1.7;`
    );

    const codeNode = doc.createElement('code');
    codeNode.textContent = code.textContent || '';
    pre.appendChild(codeNode);
    wrapper.appendChild(pre);

    block.parentNode.replaceChild(wrapper, block);
  });
}

function flattenListItems(doc) {
  doc.querySelectorAll('li').forEach((item) => {
    const text = (item.textContent || '').replace(/\s+/g, ' ').trim();
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

export async function copyToWechat({ renderedHTML, styleConfig, imageStore, showToast, codeTheme, codeBlockSettings }) {
  if (!renderedHTML) {
    showToast('没有内容可复制', 'error');
    return false;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(renderedHTML, 'text/html');

    convertGridToTable(doc);

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

    convertCodeBlocks(doc, codeTheme, codeBlockSettings);
    flattenListItems(doc);
    normalizeBlockquotes(doc);
    wrapSectionIfNeeded(doc, styleConfig);

    const html = doc.body.innerHTML;
    const text = doc.body.textContent || '';

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
