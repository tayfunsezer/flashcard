(function (LG) {
  const { h, clear } = LG.dom;
  const BOARD_SIZE = 6;
  const FLASH_MS = 400;

  function clock(seconds) {
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  LG.screens.match = {
    render(root, params) {
      const app = LG.app;
      const mode = params.mode || 'review';
      const s2t = app.state.settings.direction !== 't2s';
      const langS = app.ctx.langSource;
      const langT = app.ctx.langTarget;
      const screen = h('div', { class: 'screen' });
      root.append(screen);

      const set = app.state.studySet;
      const pool = mode === 'study'
        ? (set && set.game === 'match' ? LG.study.nextIds(set, BOARD_SIZE) : [])
        : (params.ids || []);
      const ids = pool.filter((id) => app.ctx.itemsById.has(id)).slice(0, BOARD_SIZE);
      if (!ids.length) {
        app.banner('Nothing to play in this round.', 'info');
        return app.go('home');
      }

      const board = { found: 0, startedAt: 0, picked: [null, null], locked: false, missed: [], timer: null };
      const done = new Set();
      const boxBefore = new Map(ids.map((id) => [id, (app.state.progress[id] && app.state.progress[id].box) || 0]));
      const text = (id, side) => {
        const it = app.ctx.itemsById.get(id);
        return side === 0 ? (s2t ? it.source : it.target) : (s2t ? it.target : it.source);
      };
      const langOf = (side) => (side === 0 ? (s2t ? langS : langT) : (s2t ? langT : langS));
      const columns = [LG.rng.shuffle(ids, Math.random), LG.rng.shuffle(ids, Math.random)];

      const timeEl = h('span', { class: 'pill', 'aria-label': 'Elapsed time' }, '0:00');
      const countEl = h('span', { class: 'muted', 'aria-label': 'Pairs found' });
      const tiles = [new Map(), new Map()];
      const colEls = columns.map((col, side) => h('div', { class: 'match-col', role: 'group',
        'aria-label': side === 0 ? 'Clues' : 'Answers' },
      col.map((id) => {
        const b = h('button', { class: 'btn tile', type: 'button', lang: langOf(side), 'aria-pressed': 'false',
          onclick: () => pick(side, id) }, text(id, side));
        tiles[side].set(id, b);
        return b;
      })));

      const quit = h('button', { class: 'btn btn-small', type: 'button', onclick: () => {
        if (window.confirm('Leave this board? Pairs matched so far are not saved.')) leave();
      } }, 'Quit');
      screen.append(
        h('div', { class: 'topbar game-head' }, h('h1', null, 'Pair Match'),
          h('div', { class: 'btn-row' }, countEl, timeEl, quit)),
        h('p', { class: 'muted small' }, 'Pick one tile from each column to make a pair.'),
        h('div', { class: 'match-board' }, colEls));

      function leave() {
        stopTimer();
        app.go('home');
      }

      function stopTimer() {
        if (board.timer) { clearInterval(board.timer); board.timer = null; }
      }

      function elapsed() {
        return board.startedAt ? Math.round((Date.now() - board.startedAt) / 1000) : 0;
      }

      function tick() {
        if (!screen.isConnected) return stopTimer();
        timeEl.textContent = clock(elapsed());
      }

      function drawCount() {
        countEl.textContent = board.found + ' / ' + ids.length;
      }
      drawCount();

      function setSelected(side, id, on) {
        const b = tiles[side].get(id);
        b.classList.toggle('tile-selected', on);
        b.setAttribute('aria-pressed', String(on));
      }

      function pick(side, id) {
        if (board.locked || done.has(id)) return;
        if (!board.startedAt) {
          board.startedAt = Date.now();
          board.timer = setInterval(tick, 500);
        }
        const prev = board.picked[side];
        if (prev !== null) setSelected(side, prev, false);
        if (prev === id) { board.picked[side] = null; return; }
        board.picked[side] = id;
        setSelected(side, id, true);
        if (board.picked[0] !== null && board.picked[1] !== null) resolve();
      }

      function resolve() {
        const [a, b] = board.picked;
        board.picked = [null, null];
        setSelected(0, a, false);
        setSelected(1, b, false);
        if (a === b) {
          done.add(a);
          for (const side of [0, 1]) {
            const el = tiles[side].get(a);
            el.classList.add('tile-done');
            el.disabled = true;
          }
          board.found += 1;
          drawCount();
          if (board.found === ids.length) finish();
          return;
        }
        for (const id of [a, b]) if (!board.missed.includes(id)) board.missed.push(id);
        board.locked = true;
        const bad = [tiles[0].get(a), tiles[1].get(b)];
        bad.forEach((el) => el.classList.add('tile-wrong'));
        setTimeout(() => {
          bad.forEach((el) => el.classList.remove('tile-wrong'));
          board.locked = false;
        }, FLASH_MS);
      }

      function finish() {
        stopTimer();
        const seconds = elapsed();
        const res = LG.play.matchBoard(app.state, { ids, missedIds: board.missed, seconds }, Date.now());
        app.setState(LG.play.completeRound(res.state, LG.dates.todayISO()));
        const moved = ids
          .map((id) => ({ id, from: boxBefore.get(id), to: app.state.progress[id].box }))
          .filter((m) => m.from !== m.to);
        app.go('summary', {
          game: 'match', mode, xp: res.xp, correct: ids.length - board.missed.length, almost: 0, wrong: board.missed.length, moved, missed: board.missed.slice(),
          again: () => app.go('match', { ids: app.roundIds('match', mode).slice(0, BOARD_SIZE), mode }),
        });
      }
    },
  };
})(globalThis.LG = globalThis.LG || {});
