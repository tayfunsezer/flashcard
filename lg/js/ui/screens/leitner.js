(function (LG) {
  const { h, clear } = LG.dom;
  const CAP = 20;
  const BOX_LABEL = ['Box 0 — missed', 'Box 1 — 1 day', 'Box 2 — 3 days', 'Box 3 — 7 days', 'Box 4 — 14 days', 'Box 5 — 30 days'];
  const CHOICES = ['flashcards', 'cloze', 'mc', 'match'];
  const MIN = { flashcards: 1, cloze: 1, mc: 4, match: 6 };

  function filtersActive(f) {
    return Boolean(f.dateFrom || f.dateTo || f.categories.length);
  }

  LG.screens.leitner = {
    render(root) {
      const app = LG.app;
      const f = app.filters;
      const pool = LG.words.filterItems(app.ctx.items, { dateFrom: f.dateFrom || null, dateTo: f.dateTo || null, categories: f.categories });
      const ids = pool.map((it) => it.id);
      const now = Date.now();
      const progress = app.state.progress;
      const board = LG.leitner.board(ids, progress, now);
      const due = LG.leitner.dueIds(ids, progress, now);
      const max = Math.max(1, board.new.count, ...board.boxes.map((b) => b.count));
      let open = null;

      const tiles = [{ box: 'new', label: 'New', count: board.new.count, due: null }]
        .concat(board.boxes.map((b) => ({ box: b.box, label: BOX_LABEL[b.box], count: b.count, due: b.due })));
      const chooser = h('div', { class: 'lb-chooser', 'aria-live': 'polite' });

      // Ids of `box` that `game` can play, in review order (due first), capped.
      function roundFor(box, game) {
        const inBox = new Set(LG.leitner.idsInBox(ids, progress, box));
        const eligible = LG.play.eligibleIds(pool.filter((it) => inBox.has(it.id)), game, app.ctx.langTarget, app.ctx.mcIds);
        return LG.schedule.buildReviewRound(eligible, progress, now, CAP);
      }

      // Why `game` cannot run with `n` ids of this box (Home rules), or null when it can.
      function blocker(game, n) {
        if (game === 'mc' && app.ctx.mcIds.size < LG.play.MC_OPTIONS) return 'not enough items in the file';
        return n >= MIN[game] ? null : 'needs ' + MIN[game];
      }

      function drawChooser() {
        clear(chooser);
        tileEls.forEach((el, i) => el.setAttribute('aria-expanded', String(tiles[i].box === open)));
        if (open === null) return;
        chooser.append(h('div', { class: 'card lb-choose' },
          h('p', { class: 'lb-choose-title' }, 'Study ' + (open === 'new' ? 'New' : 'Box ' + open) + ' with:'),
          h('div', { class: 'btn-row' }, CHOICES.map((g) => {
            const round = roundFor(open, g);
            const why = blocker(g, round.length);
            return h('button', { class: 'btn', type: 'button', disabled: !!why,
              onclick: () => app.go(g, { ids: round, mode: 'leitner' }) },
            app.TITLES[g], h('span', { class: 'muted small' }, '(' + round.length + (why ? ', ' + why : '') + ')'));
          })),
          h('button', { class: 'btn btn-link btn-small', type: 'button', onclick: () => { open = null; drawChooser(); } }, 'Close')));
      }

      const tileEls = tiles.map((t) => {
        const pct = Math.round((t.count / max) * 100);
        const meta = t.due === null ? String(t.count) : t.count + ' · ' + t.due + ' due';
        return h('button', { class: 'btn lb-tile' + (t.box === 'new' ? ' lb-new' : ' lb-box' + t.box), type: 'button',
          disabled: !t.count, 'aria-expanded': 'false',
          'aria-label': t.label + ': ' + t.count + (t.due === null ? ' cards' : ' cards, ' + t.due + ' due'),
          onclick: () => { open = open === t.box ? null : t.box; drawChooser(); } },
        h('span', { class: 'lb-stack', 'aria-hidden': 'true' }, h('span', { class: 'lb-fill', style: 'height:' + pct + '%' })),
        // "Box 1 — 1 day" wraps as "Box 1" / "— 1 day", never mid-phrase.
        h('strong', { class: 'lb-name' }, t.box === 'new' ? t.label
          : [h('span', null, 'Box ' + t.box), ' ', h('span', null, t.label.slice(t.label.indexOf('—')))]),
        h('span', { class: 'lb-meta' + (t.due ? ' lb-due' : '') }, meta));
      });

      const dueRound = due.slice(0, CAP);
      const studyDue = h('button', { class: 'btn btn-primary', type: 'button', disabled: !due.length,
        onclick: () => app.go('flashcards', { ids: dueRound, mode: 'leitner' }) },
      due.length ? 'Study due cards (' + dueRound.length + ')' : 'Nothing due today');

      root.append(h('div', { class: 'screen leitner' },
        h('div', { class: 'topbar' },
          h('div', { class: 'btn-row' }, h('h1', null, 'Leitner boxes'),
            filtersActive(f) ? h('span', { class: 'pill', title: 'Home filters apply' }, 'Filtered') : null),
          h('button', { class: 'btn', type: 'button', onclick: () => app.go('home') }, 'Back')),
        h('div', { class: 'card spread' },
          h('span', null, h('strong', null, ids.length + (ids.length === 1 ? ' card' : ' cards')),
            h('span', { class: 'muted' }, ' · ' + due.length + ' due today')),
          studyDue),
        h('div', { class: 'lb-board' }, tileEls),
        chooser,
        h('p', { class: 'muted small' }, 'Right answer → next box. Wrong answer → Box 0. A box is due again after its interval.')));
    },
  };
})(globalThis.LG = globalThis.LG || {});
