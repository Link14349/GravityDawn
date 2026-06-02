/**
 * 爆炸毁伤系统
 *
 * 核心公式：P(r) = P₀ · exp(-r / r₀)
 *   - r₀=0（动能武器）：P(r) = 0，无爆炸冲击
 *   - 爆心 1/3 半径内：质点+弹簧直接气化消失（100% 分数）
 *   - 爆炸半径内、气化区外：受径向冲量，脱离主体得 70% 分数
 */

/** 气化半径比例（占爆炸半径的比例） */
export const VAPOR_RATIO = 1 / 3;

/**
 * 计算距爆心 r 处的爆炸冲量
 * @param {number} dist - 到爆心的距离
 * @param {number} p0 - 爆炸冲击量 P₀
 * @param {number} r0 - 爆炸半径
 * @returns {number} P(r)，动能武器 r0=0 时返回 0
 */
export function calcExplosionImpulse(dist, p0, r0) {
  if (r0 <= 0) return 0;
  return p0 * Math.exp(-dist / r0);
}

/**
 * 判断某点是否在气化范围内
 * @param {number} dist - 到爆心的距离
 * @param {number} r0 - 爆炸半径
 * @returns {boolean}
 */
export function isVaporized(dist, r0) {
  if (r0 <= 0) return false;
  return dist < r0 * VAPOR_RATIO;
}

/**
 * 创建爆炸事件（供渲染和音效使用）
 * @param {number} x
 * @param {number} y
 * @param {number} radius - 爆炸半径 r0
 * @param {number} impulse - 爆炸冲量 P0
 * @returns {{ x: number, y: number, radius: number, impulse: number }}
 */
export function createExplosion(x, y, radius, impulse) {
  return { x, y, radius, impulse };
}
