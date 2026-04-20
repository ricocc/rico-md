/**
 * 主题管理器 - 主题数据访问、收藏管理、分类查询
 * @module theme-manager
 */

import { STYLES } from '../../styles/themes/index.js';

/** 主题分类定义 */
export const THEME_CATEGORIES = {
  '简约主义': ['wechat-default', 'minimalism','wechat-tech', 'wechat-elegant', 'wechat-deepread','wechat-jonyive'],
  '技术阅读': ['wechat-anthropic', 'wired', 'wechat-medium', 'wechat-apple', 'ai-coder'],
  '传统质感': ['wechat-paperpress','latepost-depth', 'wechat-ft', 'wechat-nyt', 'magazine', ],
  '设计灵感': ['kenya-emptiness', 'hische-editorial', 'ando-concrete', 'gaudi-organic', 'guardian', 'nikkei', 'lemonde'],
};

/** 推荐主题列表 */
const RECOMMENDED = ['wechat-default', 'wechat-anthropic','minimalism', 'wechat-paperpress','kenya-emptiness','wechat-jonyive'];

/**
 * 获取所有主题列表
 * @returns {Array<{key: string, name: string}>}
 */
export function getStyleList() {
  return Object.entries(STYLES).map(([key, val]) => ({ key, name: val.name }));
}

/**
 * 获取单个主题样式配置
 * @param {string} key - 主题 key
 * @returns {Object|null}
 */
export function getStyle(key) {
  return STYLES[key] || null;
}

/**
 * 获取主题显示名
 * @param {string} key
 * @returns {string}
 */
export function getStyleName(key) {
  return STYLES[key]?.name || key;
}

/**
 * 是否推荐主题
 * @param {string} key
 * @returns {boolean}
 */
export function isRecommended(key) {
  return RECOMMENDED.includes(key);
}

/**
 * 从 localStorage 读取收藏列表
 * @returns {string[]}
 */
export function getStarredStyles() {
  try {
    const saved = localStorage.getItem('starredStyles');
    return saved ? JSON.parse(saved) : [];
  } catch (_e) {
    return [];
  }
}

/**
 * 保存收藏列表到 localStorage
 * @param {string[]} list
 */
export function saveStarredStyles(list) {
  try {
    localStorage.setItem('starredStyles', JSON.stringify(list));
  } catch (_e) {
    console.error('保存收藏失败');
  }
}

/**
 * 切换主题收藏状态
 * @param {string} key - 主题 key
 * @returns {boolean} 切换后是否已收藏
 */
export function toggleStarStyle(key) {
  const list = getStarredStyles();
  const index = list.indexOf(key);
  if (index > -1) {
    list.splice(index, 1);
  } else {
    list.push(key);
  }
  saveStarredStyles(list);
  return index === -1;
}

/**
 * 按分类获取主题列表（收藏置顶）
 * @returns {Array<{category: string, themes: Array<{key: string, name: string, starred: boolean, recommended: boolean}>}>}
 */
export function getCategorizedThemes() {
  const starred = getStarredStyles();

  return Object.entries(THEME_CATEGORIES).map(([category, keys]) => ({
    category,
    themes: keys
      .filter(key => STYLES[key])
      .map(key => ({
        key,
        name: STYLES[key].name,
        starred: starred.includes(key),
        recommended: isRecommended(key)
      }))
      .sort((a, b) => {
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
        return 0;
      })
  }));
}
