/**
 * 物理常量定义
 */

// 万有引力常量（游戏尺度下的缩放值，单位：像素^3/(质量单位·秒^2)）
export const G = 2000;

// 物理模拟时间步长（秒/帧），假设 60fps
export const DT = 1 / 60;

// 子步划分（每帧内细分步数，提高积分精度）
export const SUB_STEPS = 4;

// 最小距离阈值（防止 r→0 时引力趋于无穷大）
export const MIN_DISTANCE = 5;

// 轨迹预测相关
export const PREDICTION_STEPS = 300;
export const PREDICTION_DT = 1 / 30;
