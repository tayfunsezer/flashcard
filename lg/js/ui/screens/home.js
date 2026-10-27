(function (LG) {
  const { h } = LG.dom;
  const GAME_INFO = {
    cloze: { name: 'Cloze', desc: 'Type the missing word in a sentence.', unit: ['sentence', 'sentences'] },
    mc: { name: 'Multiple Choice', desc: 'Pick the right translation from four.', unit: ['item', 'items'] },
    match: { name: 'Pair Match', desc: 'Match six pairs against the clock.', unit: ['term', 'terms'] },
    flashcards: { name: 'Flashcards', desc: 'Flip a card, then say if you knew it.', unit: ['card', 'cards'] },
  };
  const SUGGEST = { cloze: 'No sentences in this set — try Multiple Choice', mc: 'No items in this set', match: 'No terms in this set — try Cloze', flashcards: 'No items in this set' };
  // Session-only choices on this screen.
  const ui = { mode: 'review', by: 'category', value: '' };

  function studyItems() {
    const items = LG.app.ctx.items;
    return (ui.by === 'category' ? LG.words.itemsInCategory(items, ui.value) : items.filter((it) => it.date === ui.value));
  }

  function filteredItems() {
    const f = LG.app.filters;
    return LG.words.filterItems(LG.app.ctx.items, { dateFrom: f.dateFrom || null, dateTo: f.dateTo || null, categories: f.categories });
  }

  // { count, reason } for a game button given the current mode and filters.
  function availability(game, pool) {
    const app = LG.app;
    const ids = LG.play.eligibleIds(pool, game, app.ctx.langTarget, app.ctx.mcIds);
    if (game === 'mc' && app.ctx.mcIds.size < LG.play.MC_OPTIONS) return { ids, reason: 'Needs at least 4 terms, or sentences with 4 different words, in the file' };
    if (ui.mode === 'study') return { ids, reason: null };
    const usable = ui.mode === 'revenge' ? LG.schedule.revengeIds(ids, app.state.progress) : ids;
    let reason = null;
    if (game === 'cloze' && ids.length < 1) reason = 'No sentences match the filters';
    else if (game === 'mc' && ids.length < 4) reason = 'Needs at least 4 items in the filters';
    else if (game === 'match' && ids.length < 6) reason = 'Needs at least 6 terms in the filters';
    else if (game === 'flashcards' && ids.length < 1) reason = 'No items match the filters';
    else if (ui.mode === 'revenge' && usable.length < 1) reason = 'Revenge pile is empty for this game';
    return { ids: usable, reason };
  }

  function start(game, msgBox) {
    const app = LG.app;
    LG.dom.clear(msgBox);
    if (ui.mode === 'study') {
      if (!ui.value) return msgBox.append('Choose a category or date first.');
      const ids = LG.play.eligibleIds(studyItems(), game, app.ctx.langTarget, app.ctx.mcIds);
      if (!ids.length) return msgBox.append(SUGGEST[game]);
      if (app.state.studySet && !window.confirm('Replace the unfinished study set "' + app.state.studySet.value + '"?')) return;
      const set = LG.study.createStudySet({ by: ui.by, value: ui.value, game }, ids, Math.random);
      app.setState(Object.assign({}, app.state, { studySet: set }));
      return app.go(game, { ids: set.queue.slice(), mode: 'study' });
    }
    const { ids } = availability(game, filteredItems());
    const round = ui.mode === 'revenge'
      ? ids.slice(0, 10)
      : LG.schedule.buildReviewRound(ids, app.state.progress, Date.now(), 10);
    app.go(game, { ids: round, mode: ui.mode });
  }

  function statsRow() {
    const app = LG.app;
    const st = app.state;
    const lv = LG.rewards.levelInfo(st.xp);
    const revenge = LG.schedule.revengeIds(app.ctx.items.map((it) => it.id), st.progress).length;
    return h('div', { class: 'stats card' },
      h('div', { class: 'stat-level' },
        h('strong', null, 'Level ' + lv.level),
        h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(lv.progress * 100), 'aria-label': 'XP to next level' },
          h('span', { style: 'width:' + (lv.progress * 100).toFixed(1) + '%' })),
        h('span', { class: 'muted small' }, st.xp + ' / ' + lv.nextXp + ' XP')),
      h('span', null, 'Streak ' + st.streak.current, h('span', { class: 'muted' }, ' (best ' + st.streak.best + ')')),
      h('span', null, 'Revenge ' + revenge));
  }

  function dailyCard() {
    const app = LG.app;
    const d = app.state.daily;
    const done = d.date === LG.dates.todayISO() && d.done;
    return h('div', { class: 'card spread' },
      h('div', null, h('h2', { style: 'margin:0' }, "Today's word"),
        h('span', { class: 'muted small' }, done ? (d.won ? 'Solved today.' : 'Played today.') : 'Guess the word of the day in six tries.')),
      done ? h('span', { class: 'pill pill-ok' }, 'Done')
        : h('button', { class: 'btn btn-primary', type: 'button', onclick: () => app.go('daily') }, "Play today's word"));
  }

  function studyResume() {
    const app = LG.app;
    const set = app.state.studySet;
    if (!set) return null;
    const label = set.by === 'date' ? LG.dates.formatDate(set.value) : set.value;
    return h('div', { class: 'card spread' },
      h('span', null, 'Resume study set: ' + label + ' (' + LG.app.TITLES[set.game] + ') — ' + set.done.length + '/' + set.total),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => app.go(set.game, { ids: set.queue.slice(), mode: 'study' }) }, 'Resume'),
        h('button', { class: 'btn', type: 'button', onclick: () => {
          if (!window.confirm('Discard this study set?')) return;
          app.setState(Object.assign({}, app.state, { studySet: null }));
          app.refresh();
        } }, 'Discard')));
  }

  function radio(name, value, label, checked, onchange) {
    return h('label', { class: 'choice' },
      h('input', { type: 'radio', name, value, checked, onchange }), label);
  }

  function playCard() {
    const card = h('div', { class: 'card' });
    const render = () => {
      const app = LG.app;
      const opts = LG.words.groupOptions(app.ctx.items);
      const list = ui.by === 'category'
        ? opts.categories.map((c) => [c.name, c.name + ' (' + c.count + ')'])
        : opts.dates.map((d) => [d.date, LG.dates.formatDate(d.date) + ' (' + d.count + ')']);
      if (ui.mode === 'study' && !list.some(([v]) => v === ui.value)) ui.value = list.length ? list[0][0] : '';
      const msgBox = h('p', { class: 'error-text', role: 'status' });
      const pool = ui.mode === 'study' ? studyItems() : filteredItems();
      const setMode = (m) => () => { ui.mode = m; render(); };

      const studyControls = ui.mode !== 'study' ? null : h('div', { class: 'row', style: 'margin-top:8px' },
        h('select', { 'aria-label': 'Study set by', onchange: (e) => { ui.by = e.target.value; ui.value = ''; render(); } },
          h('option', { value: 'category', selected: ui.by === 'category' }, 'Category'),
          h('option', { value: 'date', selected: ui.by === 'date' }, 'Date')),
        ui.by === 'category'
          ? (list.length
            ? LG.catpicker.single({ options: opts.categories, value: ui.value, lang: app.ctx.langTarget, onchange: (name) => { ui.value = name; render(); } })
            : h('span', { class: 'muted small' }, 'No categories in this file.'))
          : (list.length
            ? h('select', { 'aria-label': 'Date', onchange: (e) => { ui.value = e.target.value; render(); } },
              list.map(([v, text]) => h('option', { value: v, selected: v === ui.value }, text)))
            : h('span', { class: 'muted small' }, 'No dated items in this file.')),
        h('span', { class: 'muted small' }, 'Filters are ignored for study sets.'));

      const revengeIdsFor = (g) => LG.schedule.revengeIds(LG.play.eligibleIds(pool, g, app.ctx.langTarget, app.ctx.mcIds), app.state.progress);
      const revengeTotal = ui.mode === 'revenge'
        ? LG.schedule.revengeIds(pool.map((it) => it.id), app.state.progress).length : 0;
      const modeNote = {
        review: 'Review: a 10-word round of the words due now, then new words.',
        revenge: 'Revenge pile: words you answered wrong — ' + revengeTotal + ' right now. Answer them right to clear them.',
        study: 'Study set: every word in one category or date, until you get each one right.',
      }[ui.mode];
      const revengeEmpty = ui.mode === 'revenge' && app.GAMES.every((g) => revengeIdsFor(g).length === 0);

      const studyLine = ui.mode === 'study' && ui.value
        ? h('p', { class: 'study-line' },
          h('strong', null, 'Studying: ' + (ui.by === 'date' ? LG.dates.formatDate(ui.value) : ui.value)),
          ' (' + pool.length + (pool.length === 1 ? ' word' : ' words') + ')')
        : null;

      const games = revengeEmpty
        ? h('div', { class: 'empty-pile' },
          h('p', { class: 'muted' }, 'Your revenge pile is empty. Words you miss in any game land here.'),
          h('button', { class: 'btn btn-small', type: 'button', onclick: setMode('review') }, 'Switch to Review'))
        : h('div', { class: 'grid games' }, app.GAMES.map((g) => {
          const info = GAME_INFO[g];
          const a = availability(g, pool);
          const count = ui.mode === 'revenge' ? a.ids.length + ' in revenge pile' : a.ids.length + ' ' + info.unit[a.ids.length === 1 ? 0 : 1];
          return h('button', { class: 'btn game', type: 'button', disabled: !!a.reason, onclick: () => start(g, msgBox) },
            h('strong', null, info.name),
            h('span', { class: 'muted' }, info.desc),
            h('span', { class: 'game-reason' }, a.reason || count),
            a.reason ? null : h('span', { class: 'btn-like' }, 'Start ' + info.name));
        }));

      LG.dom.clear(card).append(
        h('div', { class: 'spread' }, h('h2', { style: 'margin:0' }, 'Play'), directionToggle()),
        h('fieldset', { style: 'margin:12px 0' },
          h('legend', { class: 'small' }, 'Mode'),
          h('div', { class: 'row' },
            radio('mode', 'review', 'Review', ui.mode === 'review', setMode('review')),
            radio('mode', 'revenge', 'Revenge pile', ui.mode === 'revenge', setMode('revenge')),
            radio('mode', 'study', 'Study set', ui.mode === 'study', setMode('study'))),
          h('p', { class: 'muted small mode-note' }, modeNote),
          studyControls),
        studyLine || '', games, msgBox);
    };
    card.refresh = render;
    render();
    return card;
  }

  function directionToggle() {
    const app = LG.app;
    const dir = app.state.settings.direction;
    const btn = (value, label) => h('button', { class: 'btn', type: 'button', 'aria-pressed': String(dir === value),
      onclick: () => { app.setSettings({ direction: value }); app.refresh(); } }, label);
    return h('div', { class: 'segmented', role: 'group', 'aria-label': 'Direction (Multiple Choice, Pair Match and Flashcards)' },
      btn('s2t', 'Source → Target'), btn('t2s', 'Target → Source'));
  }

  function filtersCard(onchange) {
    const app = LG.app;
    const f = app.filters;
    const catOptions = LG.words.groupOptions(app.ctx.items).categories;
    const dateInput = (key, label) => h('label', { class: 'field' }, h('span', null, label),
      h('input', { type: 'date', value: f[key], onchange: (e) => { f[key] = e.target.value; changed(); } }));
    const isActive = () => Boolean(f.dateFrom || f.dateTo || f.categories.length);
    const marker = h('span', { class: 'muted small' });
    const changed = () => { marker.textContent = isActive() ? ' (active)' : ''; onchange(); };
    marker.textContent = isActive() ? ' (active)' : '';
    return h('details', { class: 'card', open: isActive() },
      h('summary', null, h('strong', null, 'Filters'), marker),
      h('div', { class: 'stack', style: 'margin-top:12px' },
        h('div', { class: 'row' }, dateInput('dateFrom', 'Date from'), dateInput('dateTo', 'Date to')),
        h('fieldset', null, h('legend', { class: 'small' }, 'Categories'),
          LG.catpicker.multi({ options: catOptions, selected: f.categories, lang: app.ctx.langTarget,
            onchange: (sel) => { f.categories = sel; changed(); } })),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => {
          Object.assign(f, { dateFrom: '', dateTo: '', categories: [] });
          app.refresh();
        } }, 'Clear filters')));
  }

  function footer() {
    const app = LG.app;
    return h('div', { class: 'card stack' },
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onclick: () => app.go('map') }, 'Category Map'),
        h('button', { class: 'btn', type: 'button', onclick: () => app.go('leitner') }, 'Leitner boxes'),
        h('button', { class: 'btn', type: 'button', onclick: () => app.go('settings') }, 'Settings'),
        h('button', { class: 'btn', type: 'button', onclick: async () => {
          if (!window.confirm('Load a new file? Your progress is kept for words that are in the new file.')) return;
          app.go('load');
        } }, 'Load new file')),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => { app.exportNow(); app.refresh(); } }, 'Export progress'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: async () => { if (await app.importFromFile()) app.refresh(); } }, 'Import progress'),
        h('span', { class: 'muted small' }, 'Last exported: ' + app.lastExportText())));
  }

  LG.screens.home = {
    render(root) {
      const app = LG.app;
      const play = playCard();
      root.append(h('div', { class: 'screen' },
        h('div', { class: 'topbar' }, h('h1', null, 'Language Game'),
          h('span', { class: 'muted small' }, app.dataset.fileName + ' · ' + app.ctx.items.length + ' items')),
        statsRow(), dailyCard(), studyResume(), play, filtersCard(() => play.refresh()), footer()));
    },
  };
})(globalThis.LG = globalThis.LG || {});
