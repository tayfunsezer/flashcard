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
    // Set by Cloze, Multiple Choice and Flashcards: lets Refresh update the running round instead of ending it.
    activeRound: null,
    // Answers loaded from Claude (see LG.claude): { version, byId, lastRequest }.
    notes: LG.claude.emptyNotes(),
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
    const mcIds = new Set(LG.play.mcEligibleIds(items, rarity, langTarget, app.state.settings.ask));
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
    if (next.settings.langSource !== prev.langSource || next.settings.langTarget !== prev.langTarget || next.settings.ask !== prev.ask) rebuildCtx();
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
    if (mode === 'marked') return LG.play.startRound(LG.play.markedIds(ids, app.state.progress));
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

  // Replace the Claude notes and save them in the background (a failed save only costs the next page load).
  function setNotes(next) {
    app.notes = next;
    Promise.resolve(LG.storage.saveNotes(next)).catch(() => banner('Claude answers could not be stored in this browser.', 'warn'));
  }

  // Clears the Home filters in place (screens hold the `app.filters` reference).
  function resetFilters() {
    Object.assign(app.filters, { dateFrom: '', dateTo: '', categories: [] });
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

  // Re-read the loaded file: its stored handle where the browser kept one, else a banner whose button re-picks it.
  // Nothing opens a picker after an await here (the click's user gesture may be gone), so a missing, denied or
  // unreadable handle always goes through the banner button, which is a fresh gesture.
  async function refreshFile({ inGame = false } = {}) {
    if (!app.dataset) return;
    if (inGame && !liveRound() && !window.confirm('Refresh the file? This round ends; answers so far are kept.')) return;
    if (app.dataset.sourceUrl) {
      // A list loaded from a link refreshes from the link: no handle, no picker.
      try {
        return await finishRefresh(await LG.remote.fetchFile(app.dataset.sourceUrl, { fileName: app.dataset.fileName }));
      } catch (e) {
        clearRefreshBanners();
        const el = banner('Could not refresh: ' + ((e && e.message) || String(e)), 'error');
        el.insertBefore(h('button', { class: 'btn btn-small load-file', type: 'button', onclick: () => { el.remove(); go('load'); } }, 'Load file…'), el.lastChild);
        return;
      }
    }
    let file = null;
    try {
      const handle = await LG.storage.loadHandle();
      if (handle) {
        // Bounded: a stuck permission prompt or read falls through to the pick-again banner.
        file = await LG.dom.withTimeout((async () => {
          let perm = await handle.queryPermission({ mode: 'read' });
          if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'read' });
          return perm === 'granted' ? handle.getFile() : null;
        })(), 15000, null);
      }
    } catch (e) {
      file = null;
    }
    if (file) return finishRefresh(file);
    clearRefreshBanners();
    const el = banner(PICK_AGAIN, 'info');
    if (!el.querySelector('.choose-file')) {
      el.insertBefore(h('button', { class: 'btn btn-small choose-file', type: 'button', onclick: () => { el.remove(); pickAndRefresh(); } }, 'Choose file'), el.lastChild);
    }
  }

  // Runs straight from a click (no await before the picker).
  async function pickAndRefresh() {
    // The plain file input (see the load screen): no handle, so the next Refresh asks to pick again.
    const file = await LG.dom.pickFile(LG.importer.ACCEPT);
    if (!file) return;
    const picked = { file, handle: null };
    // A different file is a fresh import: column mapping, languages and summary on the load screen.
    if (picked.file.name.toLowerCase() !== app.dataset.fileName.toLowerCase()) return go('load', { file: picked.file, handle: picked.handle });
    if (picked.handle) {
      try { await LG.storage.saveHandle(picked.handle); } catch (e) { /* next refresh re-picks */ }
    }
    return finishRefresh(picked.file);
  }

  async function finishRefresh(file) {
    let res;
    try {
      res = LG.reload.reparse(await LG.importer.readFile(file), file.name, app.dataset.learnColumn || app.state.settings.learnColumn);
    } catch (e) {
      res = { ok: false, error: (e && e.message) || String(e) };
    }
    clearRefreshBanners();
    if (!res.ok) {
      const el = banner('Could not refresh: ' + res.error, 'error');
      if (!el.querySelector('.load-file')) {
        el.insertBefore(h('button', { class: 'btn btn-small load-file', type: 'button', onclick: () => { el.remove(); go('load'); } }, 'Load file…'), el.lastChild);
      }
      return;
    }
    if (app.dataset.sourceUrl) res.dataset.sourceUrl = app.dataset.sourceUrl;
    const d = LG.reload.diff(app.dataset.items, res.dataset.items);
    // Edited rows keep their progress: the old id's entry moves to the corrected row.
    const pairs = LG.reload.carryOver(app.dataset.items, res.dataset.items);
    const map = new Map(pairs.map((p) => [p.from, p.to]));
    const newIds = new Set(res.dataset.items.map((it) => it.id));
    const removed = new Set(app.dataset.items.map((it) => it.id).filter((id) => !newIds.has(id) && !map.has(id)));
    const live = liveRound();
    try {
      await LG.storage.saveDataset(res.dataset);
    } catch (e) {
      banner('The word list could not be stored; it will need loading again next time.', 'warn');
    }
    if (pairs.length) {
      setState(LG.reload.carryState(app.state, pairs));
      setNotes(LG.claude.carryNotes(app.notes, pairs));
    }
    setDataset(res.dataset);
    if (live) live.onDataset(map, removed); // a running game keeps its round
    else go('home');
    banner(LG.reload.bannerText(file.name, d, pairs.length), 'info');
  }

  function liveRound() {
    return app.activeRound && app.activeRound.screen.isConnected ? app.activeRound : null;
  }

  const PICK_AGAIN = 'Pick the file again to refresh it.';

  function clearRefreshBanners() {
    for (const b of Array.from(document.getElementById('banners').children)) {
      if (/^(Refreshed |Could not refresh: |Pick the file again)/.test(b.dataset.text || '')) b.remove();
    }
  }

  // Small ↻ for game headers; none for the built-in sample, which has no file to re-read.
  function refreshButton() {
    if (!app.dataset || app.dataset.fileName === 'Sample data') return null;
    return h('button', { class: 'btn btn-small refresh-file', type: 'button', title: 'Refresh file', 'aria-label': 'Refresh file',
      onclick: () => refreshFile({ inGame: true }) }, '↻');
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
      try { await LG.storage.saveDataset(ds); await LG.storage.saveHandle(null); } catch (e) { /* sample still usable for this page load */ }
      setSettings({ langSource: 'en', langTarget: 'pl', learnColumn: 1 });
    }
    if (!ds) return go('load');
    try { app.notes = LG.claude.normaliseNotes(await LG.storage.loadNotes()); } catch (e) { app.notes = LG.claude.emptyNotes(); }
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
    GAMES, TITLES, go, refresh, save, setState, setSettings, applyTheme, rebuildCtx, setDataset, setNotes, resetFilters,
    banner, reviewRound, roundIds, lastExportText, exportNow, importFromFile, refreshFile, refreshButton, boot,
  });
  LG.app = app;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else setTimeout(boot, 0);
  }
})(globalThis.LG = globalThis.LG || {});
