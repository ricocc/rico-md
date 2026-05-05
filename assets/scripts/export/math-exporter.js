/**
 * Math export helpers for WeChat-compatible clipboard HTML.
 * Converts KaTeX preview nodes into MathJax SVG nodes only during export.
 * @module math-exporter
 */

const MATHJAX_SCRIPT_ID = 'mathjax-script';
const FORMULA_SELECTOR = '[data-formula-source][data-math-mode]';

let mathJaxReadyPromise = null;

export async function convertMathForWechat(doc) {
  const formulas = collectFormulaNodes(doc);
  if (formulas.length === 0) return;

  let mathJax = null;
  try {
    mathJax = await ensureMathJax();
  } catch (error) {
    formulas.forEach(({ node, latex, displayMode }) => {
      replaceFormulaNode(node, buildFallbackNode(doc, latex, displayMode));
    });
    return;
  }

  for (const { node, latex, displayMode } of formulas) {
    try {
      const svgMarkup = await renderFormulaToSvgMarkup(mathJax, latex, displayMode);
      replaceFormulaNode(node, buildFormulaNode(doc, svgMarkup, latex, displayMode));
    } catch (_error) {
      replaceFormulaNode(node, buildFallbackNode(doc, latex, displayMode));
    }
  }
}

export function stripFormulaExportMetadata(root) {
  if (!root?.querySelectorAll) return;

  root.querySelectorAll('[data-formula-plain], [data-formula-source], [data-math-mode]').forEach((node) => {
    node.removeAttribute('data-formula-plain');
    node.removeAttribute('data-formula-source');
    node.removeAttribute('data-math-mode');
  });
}

function collectFormulaNodes(doc) {
  const formulas = Array.from(doc.querySelectorAll(FORMULA_SELECTOR))
    .map((node) => buildFormulaRecord(node, node.getAttribute('data-formula-source'), node.getAttribute('data-math-mode')))
    .filter(Boolean);

  if (formulas.length > 0) return dedupeFormulaNodes(formulas);

  const fallback = [];
  const seen = new Set();

  doc.querySelectorAll('annotation[encoding="application/x-tex"]').forEach((annotation) => {
    const node = resolveFormulaRoot(annotation);
    if (!node || seen.has(node)) return;
    seen.add(node);

    const displayMode = node.classList?.contains('katex-display');
    const record = buildFormulaRecord(node, annotation.textContent || '', displayMode ? 'display' : 'inline');
    if (record) fallback.push(record);
  });

  return fallback;
}

function dedupeFormulaNodes(formulas) {
  const seen = new Set();
  return formulas.filter((formula) => {
    if (seen.has(formula.node)) return false;
    seen.add(formula.node);
    return true;
  });
}

function buildFormulaRecord(node, latex, mode) {
  const normalizedLatex = normalizeLatex(latex);
  if (!node || !normalizedLatex) return null;

  return {
    node,
    latex: normalizedLatex,
    displayMode: mode === 'display'
  };
}

function resolveFormulaRoot(annotation) {
  if (!annotation?.closest) return null;
  return annotation.closest('.katex-display') || annotation.closest('.katex');
}

function normalizeLatex(latex) {
  return String(latex || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function ensureMathJax() {
  if (mathJaxReadyPromise) return mathJaxReadyPromise;

  mathJaxReadyPromise = new Promise((resolve, reject) => {
    const finalize = () => {
      const mathJax = window.MathJax;

      if (!mathJax) {
        reject(new Error('MathJax global is unavailable.'));
        return;
      }

      if (typeof mathJax.tex2svgPromise === 'function' && mathJax.startup?.promise) {
        mathJax.startup.promise.then(() => resolve(mathJax)).catch(reject);
        return;
      }

      if (typeof mathJax.tex2svgPromise === 'function') {
        resolve(mathJax);
        return;
      }

      reject(new Error('MathJax TeX to SVG API is unavailable.'));
    };

    if (window.MathJax?.startup?.promise || typeof window.MathJax?.tex2svgPromise === 'function') {
      finalize();
      return;
    }

    const script = document.getElementById(MATHJAX_SCRIPT_ID);
    if (!script) {
      reject(new Error('MathJax script tag is missing.'));
      return;
    }

    script.addEventListener('load', finalize, { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load MathJax.')), { once: true });
  });

  return mathJaxReadyPromise;
}

async function renderFormulaToSvgMarkup(mathJax, latex, displayMode) {
  const mathNode = await mathJax.tex2svgPromise(latex, { display: displayMode });
  const svg = extractSvgNode(mathNode);
  if (!svg) {
    throw new Error('MathJax did not return an SVG node.');
  }

  const clonedSvg = svg.cloneNode(true);
  processSvgElement(clonedSvg, displayMode);
  return clonedSvg.outerHTML;
}

function extractSvgNode(mathNode) {
  if (!mathNode) return null;
  if (mathNode.tagName?.toLowerCase() === 'svg') return mathNode;
  return mathNode.querySelector?.('svg') || null;
}

function processSvgElement(svg, displayMode) {
  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  const width = svg.getAttribute('width');
  const height = svg.getAttribute('height');
  let style = svg.getAttribute('style') || '';

  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('focusable');
  svg.removeAttribute('role');
  svg.removeAttribute('aria-hidden');

  if (width && !hasStyle(style, 'width')) {
    style += ` width: ${width};`;
  }

  if (height && !hasStyle(style, 'height')) {
    style += ` height: ${height};`;
  }

  if (!hasStyle(style, 'vertical-align')) {
    style += ' vertical-align: middle;';
  }

  if (!hasStyle(style, 'overflow')) {
    style += ' overflow: visible;';
  }

  if (!hasStyle(style, 'max-width')) {
    style += ` max-width: ${displayMode ? 'none' : '300%'} !important;`;
  }

  if (displayMode && !hasStyle(style, 'display')) {
    style += ' display: inline-block;';
  }

  if (displayMode && !hasStyle(style, 'min-width')) {
    style += ' min-width: max-content;';
  }

  svg.setAttribute('style', normalizeStyleText(style));
}

function hasStyle(styleText, property) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|;)\\s*${escapedProperty}\\s*:`, 'i').test(styleText || '');
}

function normalizeStyleText(styleText) {
  return String(styleText || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*;\s*/g, '; ')
    .trim();
}

function buildFormulaNode(doc, svgMarkup, latex, displayMode) {
  if (!displayMode) {
    const wrapper = doc.createElement('span');
    wrapper.setAttribute('data-formula-plain', buildFormulaPlainText(latex, false));
    wrapper.setAttribute(
      'style',
      'display: inline-block !important; vertical-align: middle !important; margin: 0 0.12em !important;'
    );
    wrapper.innerHTML = svgMarkup;
    return wrapper;
  }

  const outer = doc.createElement('section');
  outer.setAttribute('data-formula-plain', buildFormulaPlainText(latex, true));
  outer.setAttribute(
    'style',
    'display: block !important; margin: 16px 0 !important; text-align: left !important;'
  );

  const scroller = doc.createElement('section');
  scroller.setAttribute(
    'style',
    'display: block !important; overflow-x: auto !important; overflow-y: hidden !important; -webkit-overflow-scrolling: touch !important; white-space: nowrap !important; padding: 12px 4px 12px 4px !important; box-sizing: border-box !important;'
  );

  const content = doc.createElement('span');
  content.setAttribute(
    'style',
    'display: inline-block !important; min-width: max-content !important;'
  );
  content.innerHTML = svgMarkup;

  scroller.appendChild(content);
  outer.appendChild(scroller);
  return outer;
}

function buildFallbackNode(doc, latex, displayMode) {
  const wrapper = doc.createElement(displayMode ? 'section' : 'span');
  const plainText = buildFormulaPlainText(latex, displayMode);

  wrapper.setAttribute('data-formula-plain', plainText);
  wrapper.setAttribute(
    'style',
    displayMode
      ? 'display: block !important; margin: 16px 0 !important; white-space: pre-wrap !important; word-break: break-word !important;'
      : 'display: inline !important; white-space: pre-wrap !important;'
  );
  wrapper.textContent = plainText;
  return wrapper;
}

function buildFormulaPlainText(latex, displayMode) {
  return displayMode ? `$$\n${latex}\n$$` : `$${latex}$`;
}

function replaceFormulaNode(sourceNode, nextNode) {
  if (!sourceNode?.parentNode || !nextNode) return;
  sourceNode.parentNode.replaceChild(nextNode, sourceNode);
}
