(function (LG) {
  const { h, clear } = LG.dom;
  const BOARD_SIZE = 6;
  const FLASH_MS = 400;

  function clock(seconds) {
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  LG.screens.match = {
    // A round is consecutive boards of up to BOARD_SIZE pairs over all its ids (study: until the set is finished).
    render(root, params) {
      const app = LG.app;
      const mode = params.mode || 'review';
      const s2t = app.state.settings.direction !== 't2s';
      const langS = app.ctx.langSource;
      const langT = app.ctx.langTarget;
      const screen = h('div', { class: 'screen' });
      root.append(screen);

      const study = mode === 'study';
      const studySet = () => {
        const set = app.state.studySet;
        return set && set.game === 'match' ? set : null;
      };
      const plan = study ? [] : LG.play.boards((params.ids || []).filter((id) => app.ctx.itemsById.has(id)), BOARD_SIZE);
      const boardIds = (k) => {
        if (!study) return plan[k] || [];
        const set = studySet();
        return set ? LG.study.nextIds(set, BOARD_SIZE).filter((id) => app.ctx.itemsById.has(id)) : [];
      };
      if (!boardIds(0).length) {
        app.banner('Nothing to play in this round.', 'info');
        return app.go('home');
      }

      const total = { xp: 0, correct: 0, wrong: 0, missed: [], boxBefore: new Map(), touched: [] };
      let onEnter = null;
      const keydown = (e) => {
        if (!screen.isConnected) { document.removeEventListener('keydown', keydown); return; }
        // A focused button handles Enter natively.
        if (e.key !== 'Enter' || !onEnter || (e.target && e.target.tagName === 'BUTTON')) return;
        e.preventDefault();
        onEnter();
      };
      document.addEventListener('keydown', keydown);

      const text = (id, side) => {
        const it = app.ctx.itemsById.get(id);
        return side === 0 ? (s2t ? it.source : it.target) : (s2t ? it.target : it.source);
      };
      const langOf = (side) => (side === 0 ? (s2t ? langS : langT) : (s2t ? langT : langS));

      function home() {
        document.removeEventListener('keydown', keydown);
        app.go('home');
      }

      function playBoard(k) {
        const ids = boardIds(k);
        onEnter = null;
        for (const id of ids) {
          if (total.boxBefore.has(id)) continue;
          total.boxBefore.set(id, (app.state.progress[id] && app.state.progress[id].box) || 0);
          total.touched.push(id);
        }
        const board = { found: 0, startedAt: 0, picked: [null, null], locked: false, missed: [], timer: null };
        const done = new Set();
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
          const msg = k ? 'Leave this board? Earlier boards are kept; pairs on this board are not saved.'
            : 'Leave this board? Pairs matched so far are not saved.';
          if (window.confirm(msg)) { stopTimer(); home(); }
        } }, 'Quit');
        const boardLabel = study ? 'Board ' + (k + 1) : plan.length > 1 ? 'Board ' + (k + 1) + ' of ' + plan.length : null;
        clear(screen).append(
          h('div', { class: 'topbar game-head' }, h('h1', null, 'Pair Match'),
            h('div', { class: 'btn-row' }, boardLabel ? h('span', { class: 'muted' }, boardLabel) : null, countEl, timeEl, quit)),
          h('p', { class: 'muted small' }, 'Pick one tile from each column to make a pair.'),
          h('div', { class: 'match-board' }, colEls));

        function stopTimer() {
          if (board.timer) { clearInterval(board.timer); board.timer = null; }
        }

        function elapsed() {
          return board.startedAt ? Math.round((Date.now() - board.startedAt) / 1000) : 0;
        }

        function tick() {
          if (!timeEl.isConnected) return stopTimer();
          timeEl.textContent = clock(elapsed());
        }

        function drawCount() {
          countEl.textContent = board.found + ' / ' + ids.length + ' pairs';
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
            if (board.found === ids.length) boardDone();
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

        // Each board is saved as it ends (XP via matchBoard, its own timer).
        function boardDone() {
          stopTimer();
          const res = LG.play.matchBoard(app.state, { ids, missedIds: board.missed, seconds: elapsed() }, Date.now());
          app.setState(res.state);
          total.xp += res.xp;
          total.correct += ids.length - board.missed.length;
          total.wrong += board.missed.length;
          for (const id of board.missed) if (!total.missed.includes(id)) total.missed.push(id);
          const more = study ? !!studySet() && !LG.study.isFinished(studySet()) : k + 1 < plan.length;
          if (!more) return finish();
          between(k, res.xp, board.missed.length);
        }
      }

      // Compact step between boards: "Board k of K done — Next board" (Enter works).
      function between(k, xp, misses) {
        const go = () => playBoard(k + 1);
        const next = h('button', { class: 'btn btn-primary', type: 'button', onclick: go }, 'Next board');
        const set = study ? studySet() : null;
        const title = study ? 'Board ' + (k + 1) + ' done' : 'Board ' + (k + 1) + ' of ' + plan.length + ' done';
        const detail = (misses ? misses + (misses === 1 ? ' miss' : ' misses') : 'No misses') + ' · +' + xp + ' XP'
          + (set ? ' · set ' + set.done.length + '/' + set.total : '');
        clear(screen).append(
          h('div', { class: 'topbar game-head' }, h('h1', null, 'Pair Match'),
            h('div', { class: 'btn-row' }, h('span', { class: 'pill' }, '+' + total.xp + ' XP'),
              h('button', { class: 'btn btn-small', type: 'button', onclick: home }, 'Quit'))),
          h('div', { class: 'card spread match-between', role: 'status' },
            h('div', { class: 'stack-tight' }, h('strong', null, title), h('span', { class: 'muted small' }, detail)),
            next));
        next.focus();
        onEnter = go;
      }

      function finish() {
        document.removeEventListener('keydown', keydown);
        app.setState(LG.play.completeRound(app.state, LG.dates.todayISO()));
        const moved = total.touched
          .map((id) => ({ id, from: total.boxBefore.get(id), to: app.state.progress[id].box }))
          .filter((m) => m.from !== m.to);
        app.go('summary', {
          game: 'match', mode, xp: total.xp, correct: total.correct, almost: 0, wrong: total.wrong, moved, missed: total.missed.slice(),
          again: () => app.go('match', { ids: app.roundIds('match', mode), mode }),
        });
      }

      playBoard(0);
    },
  };
})(globalThis.LG = globalThis.LG || {});
