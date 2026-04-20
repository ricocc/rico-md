/**
 * 主题汇总 - 自动导入所有主题并导出 STYLES 对象
 * 新增主题时只需在 themes/ 目录下添加新文件，并在此处引入
 * @module themes
 */

import { theme as wechatDefault } from './wechat-default.js';
import { theme as latepostDepth } from './latepost-depth.js';
import { theme as wechatFt } from './wechat-ft.js';
import { theme as wechatAnthropic } from './wechat-anthropic.js';
import { theme as wechatTech } from './wechat-tech.js';
import { theme as wechatElegant } from './wechat-elegant.js';
import { theme as wechatDeepread } from './wechat-deepread.js';
import { theme as wechatNyt } from './wechat-nyt.js';
import { theme as wechatJonyive } from './wechat-jonyive.js';
import { theme as wechatMedium } from './wechat-medium.js';
import { theme as wechatApple } from './wechat-apple.js';
import { theme as kenyaEmptiness } from './kenya-emptiness.js';
import { theme as hischeEditorial } from './hische-editorial.js';
import { theme as andoConcrete } from './ando-concrete.js';
import { theme as gaudiOrganic } from './gaudi-organic.js';
import { theme as guardian } from './guardian.js';
import { theme as nikkei } from './nikkei.js';
import { theme as lemonde } from './lemonde.js';
import { theme as minimalism } from './minimalism.js';
import { theme as wechatPaperpress } from './wechat-paperpress.js';

/**
 * 所有主题样式配置
 * 格式为内联 CSS 字符串（微信兼容性要求）
 */
export const STYLES = {
  'wechat-default': wechatDefault,
  'latepost-depth': latepostDepth,
  'wechat-ft': wechatFt,
  'wechat-anthropic': wechatAnthropic,
  'wechat-tech': wechatTech,
  'wechat-elegant': wechatElegant,
  'wechat-deepread': wechatDeepread,
  'wechat-nyt': wechatNyt,
  'wechat-jonyive': wechatJonyive,
  'wechat-medium': wechatMedium,
  'wechat-apple': wechatApple,
  'kenya-emptiness': kenyaEmptiness,
  'hische-editorial': hischeEditorial,
  'ando-concrete': andoConcrete,
  'gaudi-organic': gaudiOrganic,
  'guardian': guardian,
  'nikkei': nikkei,
  'lemonde': lemonde,
  'minimalism': minimalism,
  'wechat-paperpress': wechatPaperpress,
};
