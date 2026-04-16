/**
 * User preference persistence.
 * Keeps legacy keys for backward compatibility.
 * @module preferences
 */

const KEY_STYLE = 'currentStyle';
const KEY_CONTENT = 'markdownInput';
const KEY_DOCUMENTS = 'documents';
const KEY_ACTIVE_DOCUMENT_ID = 'activeDocumentId';
const KEY_CODE_BLOCK_SETTINGS = 'codeBlockSettings';

const DEFAULT_CODE_BLOCK_SETTINGS = {
  showLanguageLabel: true,
  showCopyButton: true,
  showMacDecorations: true
};

let saveTimer = null;

function parseJSON(value, fallback) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function normalizeDocument(doc, index = 0) {
  if (!doc || typeof doc !== 'object') return null;
  if (typeof doc.id !== 'string' || typeof doc.content !== 'string') return null;

  const createdAt = typeof doc.createdAt === 'number' ? doc.createdAt : Date.now();
  const updatedAt = typeof doc.updatedAt === 'number' ? doc.updatedAt : createdAt;

  return {
    id: doc.id,
    title: typeof doc.title === 'string' ? doc.title : '',
    manualTitle: typeof doc.manualTitle === 'string' ? doc.manualTitle : '',
    content: doc.content,
    createdAt,
    updatedAt,
    sortOrder: typeof doc.sortOrder === 'number' ? doc.sortOrder : index,
    dirty: Boolean(doc.dirty)
  };
}

function normalizeDocuments(documents) {
  if (!Array.isArray(documents)) return [];
  return documents.map((doc, index) => normalizeDocument(doc, index)).filter(Boolean);
}

function normalizeCodeBlockSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return { ...DEFAULT_CODE_BLOCK_SETTINGS };
  }

  return {
    showLanguageLabel: settings.showLanguageLabel !== false,
    showCopyButton: settings.showCopyButton !== false,
    showMacDecorations: settings.showMacDecorations !== false
  };
}

export function loadPreferences() {
  try {
    return {
      currentStyle: localStorage.getItem(KEY_STYLE) || 'wechat-default',
      content: localStorage.getItem(KEY_CONTENT),
      documents: normalizeDocuments(parseJSON(localStorage.getItem(KEY_DOCUMENTS), [])),
      activeDocumentId: localStorage.getItem(KEY_ACTIVE_DOCUMENT_ID),
      codeBlockSettings: normalizeCodeBlockSettings(parseJSON(localStorage.getItem(KEY_CODE_BLOCK_SETTINGS), null))
    };
  } catch (_error) {
    return {
      currentStyle: 'wechat-default',
      content: null,
      documents: [],
      activeDocumentId: null,
      codeBlockSettings: { ...DEFAULT_CODE_BLOCK_SETTINGS }
    };
  }
}

export function savePreferences(currentStyle, content, documents = null, activeDocumentId = null, codeBlockSettings = null) {
  try {
    localStorage.setItem(KEY_STYLE, currentStyle);
    localStorage.setItem(KEY_CONTENT, content);

    if (Array.isArray(documents)) {
      localStorage.setItem(KEY_DOCUMENTS, JSON.stringify(documents));
    }

    if (activeDocumentId) {
      localStorage.setItem(KEY_ACTIVE_DOCUMENT_ID, activeDocumentId);
    } else {
      localStorage.removeItem(KEY_ACTIVE_DOCUMENT_ID);
    }

    if (codeBlockSettings) {
      localStorage.setItem(KEY_CODE_BLOCK_SETTINGS, JSON.stringify(normalizeCodeBlockSettings(codeBlockSettings)));
    }

    return true;
  } catch (_error) {
    console.error('保存偏好失败');
    return false;
  }
}

export function debounceSaveContent(payload, delay = 1000, callbacks = {}) {
  if (saveTimer) clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    const {
      currentStyle = 'wechat-default',
      content = '',
      documents = null,
      activeDocumentId = null,
      codeBlockSettings = null
    } = payload || {};

    const success = savePreferences(currentStyle, content, documents, activeDocumentId, codeBlockSettings);

    if (success) {
      callbacks.onSuccess?.(payload);
    } else {
      callbacks.onError?.(payload);
    }
  }, delay);
}

export function getDefaultCodeBlockSettings() {
  return { ...DEFAULT_CODE_BLOCK_SETTINGS };
}
