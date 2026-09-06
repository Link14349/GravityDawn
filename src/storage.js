/** Stable mission IDs with best-effort local storage and legacy cookie migration. */
const SAVE_KEY = 'gravity_dawn_progress_v2';
let missionKeys = null;
let cached = null;

export function configureProgress(chapters) {
  missionKeys = chapters.map((chapter, ci) => chapter.levels.map((level, li) => level.id || level.legacyKey || `c${ci}-l${li}`));
}
function load() {
  if (cached) return cached;
  cached = { levels: {} };
  try {
    const legacy = document.cookie.match(/(?:^|; )gravity_dawn_save=([^;]+)/);
    if (legacy) Object.assign(cached.levels, JSON.parse(decodeURIComponent(legacy[1])).levels || {});
  } catch { /* Corrupt legacy saves must not stop a new expedition. */ }
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    Object.assign(cached.levels, data.levels || {});
  } catch { /* In restricted environments, retain progress for this session. */ }
  return cached;
}
const keyFor = (ci, li) => missionKeys?.[ci]?.[li] || `c${ci}-l${li}`;
export function getBest(ci, li) { return load().levels[keyFor(ci, li)] || null; }
export function saveLevel(ci, li, stars, score, passed) {
  const data = load(), key = keyFor(ci, li), prev = data.levels[key];
  if (passed) {
    data.levels[key] = { stars: Math.max(prev?.stars || 0, stars), score: Math.max(prev?.score || 0, score) };
  } else if (!prev) data.levels[key] = { stars: 0, score: 0 };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* Session progress remains usable. */ }
}
export function getAllBest() {
  if (!missionKeys) return load().levels;
  const best = {};
  missionKeys.forEach((levels, ci) => levels.forEach((key, li) => {
    const saved = load().levels[key];
    if (saved && Number.isFinite(saved.stars) && saved.stars >= 0 && saved.stars <= 3) best[`c${ci}-l${li}`] = saved;
  }));
  return best;
}
