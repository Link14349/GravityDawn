/**
 * 本地存储 — Cookie 持久化关卡分数和进度
 */
const COOKIE_KEY = 'gravity_dawn_save';
const COOKIE_DAYS = 365;

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 86400000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/`;
}

function loadSaveData() {
  try {
    const raw = getCookie(COOKIE_KEY);
    return raw ? JSON.parse(raw) : { levels: {} };
  } catch { return { levels: {} }; }
}

function saveSaveData(data) {
  setCookie(COOKIE_KEY, JSON.stringify(data), COOKIE_DAYS);
}

/** 构建存储 key */
function mkKey(chapterIdx, levelIdx) {
  return `c${chapterIdx}-l${levelIdx}`;
}

/**
 * 获取某关最佳成绩
 * @param {number} chapterIdx
 * @param {number} levelIdx
 * @returns {{ stars: number, score: number } | null}
 */
export function getBest(chapterIdx, levelIdx) {
  const data = loadSaveData();
  return data.levels[mkKey(chapterIdx, levelIdx)] || null;
}

/**
 * 保存某关成绩（仅当比历史更优时更新）
 * @param {number} chapterIdx
 * @param {number} levelIdx
 * @param {number} stars
 * @param {number} score
 * @param {boolean} passed
 */
export function saveLevel(chapterIdx, levelIdx, stars, score, passed) {
  const data = loadSaveData();
  const key = mkKey(chapterIdx, levelIdx);
  const prev = data.levels[key];
  if (!passed) {
    if (!prev) data.levels[key] = { stars: 0, score: 0 };
    saveSaveData(data);
    return;
  }
  if (!prev || stars > prev.stars || (stars === prev.stars && score > prev.score)) {
    data.levels[key] = { stars, score };
  }
  saveSaveData(data);
}

/**
 * 获取所有关卡最佳成绩
 * @returns {Object} { 'c0-l1': { stars, score }, ... }
 */
export function getAllBest() {
  return loadSaveData().levels;
}
