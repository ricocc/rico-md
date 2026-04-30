/**
 * Clipboard exporter for X-compatible rich text.
 * Writes semantic HTML plus a structured plain-text fallback.
 * @module x-clipboard-exporter
 */

const BLOCK_TAGS = new Set([
  'article',
  'aside',
  'blockquote',
  'div',
  'figcaption',
  'figure',
  'footer',
  'header',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul'
]);

function unwrapContainer(doc) {
  const onlyChild = doc.body.children.length === 1 ? doc.body.firstElementChild : null;
  if (!onlyChild || onlyChild.tagName !== 'DIV') return;

  const fragment = doc.createDocumentFragment();
  while (onlyChild.firstChild) {
    fragment.appendChild(onlyChild.firstChild);
  }

  doc.body.replaceChildren(fragment);
}

function flattenImageGrids(doc) {
  doc.querySelectorAll('.image-grid').forEach((grid) => {
    const fragment = doc.createDocumentFragment();
    Array.from(grid.querySelectorAll('img')).forEach((img) => {
      const figure = doc.createElement('figure');
      figure.appendChild(img.cloneNode(true));
      fragment.appendChild(figure);
    });
    grid.replaceWith(fragment);
  });
}

function normalizeCodeBlocks(doc) {
  doc.querySelectorAll('[data-code-block="true"]').forEach((block) => {
    const pre = doc.createElement('pre');
    const code = doc.createElement('code');
    code.textContent = block.textContent || '';
    pre.appendChild(code);
    block.replaceWith(pre);
  });
}

function stripPresentationAttributes(doc) {
  doc.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name === 'style' || name === 'class' || name.startsWith('data-') || name.startsWith('aria-')) {
        element.removeAttribute(attribute.name);
      }
    });
  });
}

function normalizeTextNodeValue(value) {
  return (value || '').replace(/\s+/g, ' ');
}

function normalizeInlineText(value) {
  return (value || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function cleanupPlainText(value) {
  return (value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function prefixLines(value, prefix) {
  return value
    .split('\n')
    .map((line) => `${prefix}${line}`.trimEnd())
    .join('\n');
}

function serializeInline(node) {
  if (!node) return '';

  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeTextNodeValue(node.nodeValue);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();

  switch (tag) {
    case 'br':
      return '\n';
    case 'strong':
    case 'b': {
      const content = normalizeInlineText(serializeInlineChildren(node));
      return content ? `**${content}**` : '';
    }
    case 'em':
    case 'i': {
      const content = normalizeInlineText(serializeInlineChildren(node));
      return content ? `*${content}*` : '';
    }
    case 'code':
      return node.closest('pre') ? (node.textContent || '') : `\`${normalizeInlineText(node.textContent || '')}\``;
    case 'a': {
      const label = normalizeInlineText(serializeInlineChildren(node)) || normalizeInlineText(node.textContent || '');
      const href = (node.getAttribute('href') || '').trim();
      if (!href || href === label) return label;
      return label ? `${label} (${href})` : href;
    }
    case 'img':
      return (node.getAttribute('alt') || '').trim() || '[图片]';
    default:
      if (BLOCK_TAGS.has(tag)) {
        return serializeBlock(node, { listDepth: 0 }).trim();
      }
      return serializeInlineChildren(node);
  }
}

function serializeInlineChildren(parent) {
  return Array.from(parent.childNodes)
    .map((child) => serializeInline(child))
    .join('');
}

function serializeList(listNode, state) {
  const ordered = listNode.tagName.toLowerCase() === 'ol';
  const start = ordered ? Number.parseInt(listNode.getAttribute('start') || '1', 10) || 1 : 1;
  const depth = (state.listDepth || 0) + 1;

  const items = Array.from(listNode.children)
    .filter((child) => child.tagName?.toLowerCase() === 'li')
    .map((item, index) => serializeListItem(item, {
      listDepth: depth,
      ordered,
      index: start + index
    }))
    .join('');

  return `${items}\n`;
}

function serializeListItem(itemNode, state) {
  const inlineParts = [];
  const nestedLists = [];

  itemNode.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE && ['ul', 'ol'].includes(child.tagName.toLowerCase())) {
      nestedLists.push(child);
      return;
    }

    inlineParts.push(serializeInline(child));
  });

  const indent = '  '.repeat(Math.max(0, state.listDepth - 1));
  const marker = state.ordered ? `${state.index}. ` : '- ';
  const content = normalizeInlineText(inlineParts.join('')) || '[空项]';

  let result = `${indent}${marker}${content}\n`;

  nestedLists.forEach((list) => {
    result += serializeList(list, { listDepth: state.listDepth });
  });

  return result;
}

function serializeTable(tableNode) {
  const rows = Array.from(tableNode.querySelectorAll('tr'))
    .map((row) => {
      const cells = Array.from(row.children)
        .filter((cell) => ['th', 'td'].includes(cell.tagName.toLowerCase()))
        .map((cell) => normalizeInlineText(serializeInlineChildren(cell)))
        .filter(Boolean);

      return cells.join(' | ');
    })
    .filter(Boolean);

  if (rows.length === 0) return '';

  return `${rows.join('\n')}\n\n`;
}

function serializeBlock(node, state = { listDepth: 0 }) {
  if (!node) return '';

  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeTextNodeValue(node.nodeValue);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = Number.parseInt(tag.slice(1), 10);
      const content = normalizeInlineText(serializeInlineChildren(node));
      return content ? `${'#'.repeat(level)} ${content}\n\n` : '';
    }
    case 'p': {
      const content = normalizeInlineText(serializeInlineChildren(node));
      return content ? `${content}\n\n` : '';
    }
    case 'blockquote': {
      const content = cleanupPlainText(serializeChildren(node, state) || serializeInlineChildren(node));
      return content ? `${prefixLines(content, '> ')}\n\n` : '';
    }
    case 'ul':
    case 'ol':
      return serializeList(node, state);
    case 'pre': {
      const code = node.textContent || '';
      return code ? `\`\`\`\n${code.replace(/\n+$/, '')}\n\`\`\`\n\n` : '';
    }
    case 'hr':
      return '---\n\n';
    case 'img': {
      const alt = (node.getAttribute('alt') || '').trim();
      return alt ? `${alt}\n\n` : '';
    }
    case 'table':
      return serializeTable(node);
    case 'figure':
    case 'figcaption':
    case 'div':
    case 'section':
    case 'article':
    case 'main':
    case 'header':
    case 'footer':
      return serializeChildren(node, state);
    default:
      if (BLOCK_TAGS.has(tag)) {
        const content = cleanupPlainText(serializeChildren(node, state));
        return content ? `${content}\n\n` : '';
      }
      return serializeInline(node);
  }
}

function serializeChildren(parent, state) {
  return Array.from(parent.childNodes)
    .map((child) => serializeBlock(child, state))
    .join('');
}

function buildPlainText(doc) {
  return cleanupPlainText(serializeChildren(doc.body, { listDepth: 0 }));
}

function buildSemanticHTML(doc) {
  unwrapContainer(doc);
  flattenImageGrids(doc);
  normalizeCodeBlocks(doc);
  stripPresentationAttributes(doc);
  return doc.body.innerHTML.trim();
}

export async function copyToX({ renderedHTML, showToast }) {
  if (!renderedHTML) {
    showToast('没有可复制的内容', 'error');
    return false;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(renderedHTML, 'text/html');
    const html = buildSemanticHTML(doc);
    const text = buildPlainText(doc);

    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      });

      await navigator.clipboard.write([item]);
      showToast('已复制富文本和结构化文本，粘贴到支持格式的 X 编辑器时会尽量保留标题和列表', 'success');
      return true;
    }

    await navigator.clipboard.writeText(text);
    showToast('当前环境不支持富文本复制，已复制结构化文本', 'success');
    return true;
  } catch (error) {
    console.error('复制到 X 失败:', error);
    showToast('复制到 X 失败', 'error');
    return false;
  }
}
