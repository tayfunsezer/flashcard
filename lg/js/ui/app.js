(function (LG) {
  const { h, clear } = LG.dom;
  const GAMES = ['cloze', 'mc', 'match', 'flashcards'];
  const TITLES = { cloze: 'Cloze', mc: 'Multiple Choice', match: 'Pair Match', flashcards: 'Flashcards', daily: 'Daily Word', map: 'Category Map', leitner: 'Leitner boxes' };
  let themeOverride = null;

  LG.screens = LG.screens || {};

  const app = {
    state: LG.state.defaultState(),
    dataset: null,
    ctx: null,
    current: null,
    filters: { dateFrom: '', dateTo: '', categories: [] },
  };

  function rebuildCtx() {
    if (!app.dataset) { app.ctx = null; return null; }
    const items = app.dataset.items;
    const { langSource, langTarget } = app.state.settings;
    const kinds = new Map();
    const itemsById = new Map();
    for (const it of items) {
      kinds.set(it.id, LG.words.kindOf(it.target, langTarget));
      itemsById.set(it.id, it);
    }
    const rarity = LG.words.buildRarity(items, langTarget);
    const mcIds = new Set(LG.play.mcEligibleIds(items, rarity, langTarget));
    app.ctx = { items, langSource, langTarget, rarity, kinds, itemsById, mcIds };
    pruneStudySet(itemsById);
    return app.ctx;
  }

  // A study set may reference items that are not in the (new) dataset: drop them, and the set if empty.
  function pruneStudySet(itemsById) {
    const set = app.state.studySet;
    if (!set) return;
    const pruned = LG.study.prune(set, new Set(itemsById.keys()));
    if (pruned && pruned.queue.length === set.queue.length && pruned.done.length === set.done.length) return;
    app.state = Object.assign({}, app.state, { studySet: pruned });
    save();
    banner(pruned ? 'Your study set was adjusted: some of its words are not in this file.'
      : 'Your unfinished study set was removed: none of its words are in this file.', 'info');
  }

  function applyTheme() {
    const t = themeOverride || app.state.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
  }

  function save() {
    if (!LG.storage.saveState(app.state)) banner('Progress could not be saved in this browser.', 'error');
  }

  function setState(next) {
    const prev = app.state.settings;
    app.state = next;
    save();
    if (next.settings.theme !== prev.theme) applyTheme();
    if (next.settings.langSource !== prev.langSource || next.settings.langTarget !== prev.langTarget) rebuildCtx();
  }

  function setSettings(patch) {
    setState(Object.assign({}, app.state, { settings: Object.assign({}, app.state.settings, patch) }));
  }

  // Dismissible message above the current screen; identical messages are not stacked.
  function banner(text, kind = 'info') {
    const box = document.getElementById('banners');
    for (const b of box.children) if (b.dataset.text === text) return b;
    const el = h('div', { class: 'banner banner-' + kind, role: kind === 'error' ? 'alert' : 'status', dataset: { text } },
      h('span', null, text),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => el.remove() }, 'Dismiss'));
    box.appendChild(el);
    return el;
  }

  function go(name, params = {}) {
    if (!app.dataset && name !== 'load') name = 'load';
    if (!LG.screens[name]) {
      if (TITLES[name]) banner(TITLES[name] + ' is coming soon.', 'info');
      name = 'home';
    }
    const root = clear(document.getElementById('app'));
    app.current = name;
    try {
      LG.screens[name].render(root, params);
    } catch (e) {
      console.error(e);
      banner('Something went wrong: ' + (e && e.message ? e.message : e), 'error');
    }
    window.scrollTo(0, 0);
  }

  function refresh() {
    go(app.current || 'home');
  }

  // A shuffled Review round of every id `game` can play (due words are included first, then shuffled: no cap).
  function reviewRound(game, ids) {
    const eligible = LG.play.eligibleIds(ids.map((id) => app.ctx.itemsById.get(id)), game, app.ctx.langTarget, app.ctx.mcIds);
    return LG.play.startRound(LG.schedule.buildReviewRound(eligible, app.state.progress, Date.now(), Infinity));
  }

  // Ids for a fresh round of `game` in `mode`, honouring the current filters (used by "Play again").
  function roundIds(game, mode) {
    if (mode === 'study') {
      const set = app.state.studySet;
      return set && set.game === game ? set.queue.slice() : [];
    }
    const f = app.filters;
    const pool = LG.words.filterItems(app.ctx.items, { dateFrom: f.dateFrom || null, dateTo: f.dateTo || null, categories: f.categories });
    const ids = LG.play.eligibleIds(pool, game, app.ctx.langTarget, app.ctx.mcIds);
    if (mode === 'revenge') return LG.play.startRound(LG.schedule.revengeIds(ids, app.state.progress));
    return LG.play.startRound(LG.schedule.buildReviewRound(ids, app.state.progress, Date.now(), Infinity));
  }

  // Datasets stored before multi-category support carry `category`; convert and re-save.
  function setDataset(ds) {
    const items = LG.importer.migrateItems(ds.items);
    if (items.some((it, i) => it !== ds.items[i])) {
      ds = Object.assign({}, ds, { items });
      Promise.resolve(LG.storage.saveDataset(ds)).catch(() => { /* migrated copy still usable for this page load */ });
    }
    app.dataset = ds;
    rebuildCtx();
  }

  function lastExportText() {
    const t = app.state.lastExport;
    if (!t) return 'never';
    const days = Math.floor((Date.now() - t) / LG.schedule.DAY_MS);
    if (days <= 0) return 'today';
    return days === 1 ? '1 day ago' : days + ' days ago';
  }

  function exportNow() {
    const now = Date.now();
    const data = LG.state.exportProgress(app.state, now);
    LG.dom.download(LG.state.exportFileName(LG.dates.todayISO()), JSON.stringify(data, null, 2));
    setState(Object.assign({}, app.state, { lastExport: now }));
  }

  async function importFromFile() {
    const file = await LG.dom.pickFile('.json');
    if (!file) return false;
    const res = LG.state.parseProgressFile(await file.text());
    if (!res.ok) { banner(res.error, 'error'); return false; }
    const s = res.summary;
    const when = typeof s.exportedAt === 'number' ? LG.dates.formatDate(LG.dates.todayISO(new Date(s.exportedAt))) : 'on an unknown date';
    const msg = 'Exported ' + when + ', ' + s.itemCount + ' items, ' + s.xp + ' XP — replace your current progress?';
    if (!window.confirm(msg)) return false;
    const cur = app.state.settings;
    const imported = LG.state.withDefaults(res.state);
    const keep = (k) => imported.settings[k] || cur[k];
    setState(Object.assign({}, imported, { settings: Object.assign({}, imported.settings, { langSource: keep('langSource'), langTarget: keep('langTarget') }) }));
    applyTheme();
    rebuildCtx();
    banner('Progress imported.', 'info');
    return true;
  }

  function sampleDataset() {
    const { items } = LG.importer.rowsToDataset(LG.sampleRows, { learnColumn: 1 });
    return { items, fileName: 'Sample data', importedAt: Date.now(), encoding: 'utf-8' };
  }

  async function boot() {
    const params = new URLSearchParams(location.search);
    const th = params.get('theme');
    themeOverride = th === 'light' || th === 'dark' ? th : null;

    const { state, warning } = LG.storage.loadState();
    app.state = state;
    applyTheme();
    if (warning) banner(warning, 'warn');

    let ds = null;
    try {
      ds = await LG.storage.loadDataset();
    } catch (e) {
      banner('The saved word list could not be opened. Load your file again.', 'warn');
    }
    if (!ds && params.get('sample') === '1') {
      ds = sampleDataset();
      try { await LG.storage.saveDataset(ds); } catch (e) { /* sample still usable for this page load */ }
      setSettings({ langSource: 'en', langTarget: 'pl', learnColumn: 1 });
    }
    if (!ds) return go('load');
    setDataset(ds);
    if (!app.state.settings.langTarget) return go('load', { dataset: ds });

    const screen = params.get('screen');
    if (!screen) return go('home');
    if (GAMES.includes(screen)) {
      const ids = params.get('ids') ? params.get('ids').split(',').filter((id) => app.ctx.itemsById.has(id)) : null;
      return go(screen, { ids: ids || reviewRound(screen, app.ctx.items.map((it) => it.id)), mode: 'review' });
    }
    go(screen);
  }

  Object.assign(app, {
    GAMES, TITLES, go, refresh, save, setState, setSettings, applyTheme, rebuildCtx, setDataset,
    banner, reviewRound, roundIds, lastExportText, exportNow, importFromFile, boot,
  });
  LG.app = app;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else setTimeout(boot, 0);
  }
})(globalThis.LG = globalThis.LG || {});
