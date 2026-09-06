/** Bundled mission definitions, loaded as a separate campaign chunk. */
  function loadChapters() {
    const files = require.context('../data/levels', true, /\.json$/);
    return [...files('./campaign-index.json'), ...files('./index.json')].map((dir, ci) => {
      const chapter = files(`./${dir}/index.json`);
      return { ...chapter, name: dir.startsWith('exp-') ? chapter.name : `旧版 · ${chapter.name}`, levels: chapter.levels.map((file, li) => ({ ...files(`./${dir}/${file}.json`), ...(!dir.startsWith('exp-') ? { legacyKey: `c${ci - 6}-l${li}` } : {}) })) };
    });
  }
export const CHAPTERS = loadChapters();
