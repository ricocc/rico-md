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
    if (selector === 'pre' || selector === 'code' || selector === 'pre code') return;

    const elements = doc.querySelectorAll(selector);
    elements.forEach((element) => {
      if (element.tagName === 'IMG' && element.closest('.image-grid')) return;
      const currentStyle = element.getAttribute('style') || '';
      element.setAttribute('style', `${currentStyle}; ${style[selector]}`);
    });
  });

  normalizeBlockquoteParagraphSpacing(doc);
  applyCodeThemeStyles(doc, codeTheme);

  const container = doc.createElement('div');
  container.setAttribute('style', style.container);
  container.innerHTML = doc.body.innerHTML;
  return container.outerHTML;
}

function normalizeBlockquoteParagraphSpacing(doc) {
  const paragraphs = doc.querySelectorAll('blockquote > p');

  paragraphs.forEach((paragraph) => {
    const currentStyle = paragraph.getAttribute('style') || '';
    paragraph.setAttribute('style', `${currentStyle}; margin: 0 !important; padding: 0;`);
  });
}

function applyCodeThemeStyles(doc, codeTheme) {
  if (!codeTheme) return;
  const blocks = doc.querySelectorAll('[data-code-block="true"]');

  blocks.forEach((block) => {
    const pre = block.querySelector('.md-code-block-pre');
    const code = block.querySelector('.md-code-block-code');

    block.setAttribute(
      'style',
      'margin: 24px 0;'
    );

    if (pre) {
      pre.setAttribute(
        'style',
        `margin: 0; padding: 16px; overflow-x: auto; background: ${codeTheme.bg}; border: 1px solid ${codeTheme.borderColor}; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.12); -webkit-box-shadow: 0 2px 8px rgba(0,0,0,0.12);`
      );
    }

    if (code) {
      code.setAttribute(
        'style',
        `display: block; margin: 0; color: ${codeTheme.textColor}; font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace; font-size: 14px; line-height: 1.7; white-space: pre; tab-size: 2;`
      );
    }
  });
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
