(function (LG) {
  const { h, clear } = LG.dom;
  const MAX_GUESSES = 6;
  const HINT_AFTER = 3;
  const RANK = { grey: 1, yellow: 2, green: 3 };

  LG.screens = LG.screens || {};

  LG.screens.daily = {
    render(root) {
      const app = LG.app;
      const lang = app.ctx.langTarget;
      const today = LG.dates.todayISO();
      const screen = h('div', { class: 'screen daily' });
      root.append(screen);

      const header = () => h('div', { class: 'topbar game-head' },
        h('h1', null, 'Daily Word'),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-small', type: 'button', onclick: () => app.go('home') }, 'Home')));

      if (app.state.daily.date !== today) {
        app.setState(Object.assign({}, app.state, { daily: { date: today, guesses: [], done: false, won: false } }));
      }

      // Built from the whole dataset (never the Home filters) so the word is stable for the day.
      const pins = {};
      for (const id of Object.keys(app.state.progress)) if (app.state.progress[id].pin) pins[id] = app.state.progress[id].pin;
      const pool = LG.daily.dailyPool(app.ctx.items, app.ctx.rarity, lang, pins);
      const entry = LG.daily.dailyEntry(pool, today);
      if (!entry) {
        screen.append(header(), h('div', { class: 'card' }, h('p', { role: 'status' }, 'Your data has no single words of 4–8 letters yet.')));
        return;
      }

      const len = LG.text.charLength(entry.word);
      const letters = Array.from(new Set(LG.daily.keyboardLetters(app.ctx.items, lang).map((c) => LG.text.lower(c, lang))));
      let cur = [];
      let message = '';
      let justFinishedXp = null;

      const keydown = (e) => {
        if (!screen.isConnected) { document.removeEventListener('keydown', keydown); return; }
        if (e.ctrlKey || e.metaKey || e.altKey || app.state.daily.done) return;
        if (e.key === 'Enter') {
          if (e.target.tagName === 'BUTTON') return;
          e.preventDefault();
          submit();
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          back();
        } else if (/^\p{L}$/u.test(e.key)) {
          type(e.key);
        }
      };
      document.addEventListener('keydown', keydown);

      function type(ch) {
        if (cur.length >= len) return;
        cur.push(LG.text.lower(ch, lang));
        message = '';
        draw();
      }

      function back() {
        cur.pop();
        message = '';
        draw();
      }

      function submit() {
        if (cur.length !== len) { message = 'Needs ' + len + ' letters'; draw(); return; }
        const guess = cur.join('');
        const guesses = app.state.daily.guesses.concat(guess);
        const won = guess === LG.text.lower(entry.word, lang);
        let next = Object.assign({}, app.state, { daily: Object.assign({}, app.state.daily, { guesses }) });
        if (won || guesses.length >= MAX_GUESSES) {
          const res = LG.play.finishDaily(next, today, won);
          next = res.state;
          justFinishedXp = res.xp;
        }
        cur = [];
        message = '';
        app.setState(next);
        draw();
      }

      function draw() {
        const d = app.state.daily;
        const scored = d.guesses.map((g) => ({ g: Array.from(g), s: LG.daily.scoreGuess(g, entry.word, lang) }));
        const best = new Map();
        for (const { g, s } of scored) {
          g.forEach((ch, i) => {
            if (!best.has(ch) || RANK[s[i]] > RANK[best.get(ch)]) best.set(ch, s[i]);
          });
        }

        const rows = [];
        for (let r = 0; r < MAX_GUESSES; r++) {
          const cells = [];
          for (let c = 0; c < len; c++) {
            let ch = '';
            let cls = 'dtile';
            let label = 'empty';
            if (r < scored.length) { ch = scored[r].g[c]; cls += ' dtile-' + scored[r].s[c]; label = ch + ', ' + scored[r].s[c]; }
            else if (r === scored.length && !d.done) { ch = cur[c] || ''; if (ch) { cls += ' dtile-filled'; label = ch; } }
            cells.push(h('span', { class: cls, role: 'gridcell', 'aria-label': label }, ch));
          }
          rows.push(h('div', { class: 'drow', role: 'row' }, cells));
        }
        const grid = h('div', { class: 'dgrid', role: 'grid', lang, 'aria-label': 'Guesses' }, rows);

        const tries = d.guesses.length;
        const parts = [];
        if (d.done) {
          parts.push(h('p', { class: 'fb-msg ' + (d.won ? 'fb-text-correct' : 'fb-text-wrong'), role: 'status' },
            d.won ? 'Solved in ' + tries + (tries === 1 ? ' try.' : ' tries.') : 'Not solved today.',
            d.won && justFinishedXp ? h('span', { class: 'muted' }, '  +' + justFinishedXp + ' XP') : null));
          parts.push(h('p', { class: 'daily-answer' }, h('strong', { lang }, entry.word), h('span', { class: 'muted' }, '  ' + entry.clue)));
          parts.push(h('div', { class: 'btn-row', style: 'justify-content:center' },
            h('button', { class: 'btn btn-primary', type: 'button', onclick: () => app.go('home') }, 'Back to Home')));
        } else {
          if (tries >= HINT_AFTER) parts.push(h('p', { class: 'daily-hint', role: 'status' }, 'Hint: ' + entry.clue));
          parts.push(h('p', { class: 'daily-msg', role: 'status' }, message || ' '));
        }

        const keyBtn = (label, cls, fn) => h('button', { class: 'btn dkey ' + cls, type: 'button', onmousedown: (e) => e.preventDefault(), onclick: fn }, label);
        const keys = d.done ? null : h('div', { class: 'dkeys', lang, role: 'group', 'aria-label': 'Keyboard' },
          h('div', { class: 'dkeys-letters' }, letters.map((ch) => keyBtn(ch, best.has(ch) ? 'dkey-' + best.get(ch) : '', () => type(ch)))),
          h('div', { class: 'btn-row dkeys-actions' },
            keyBtn('Enter', 'dkey-wide btn-primary', submit),
            keyBtn('Backspace', 'dkey-wide', back)));

        clear(screen).append(header(),
          h('div', { class: 'card' }, h('p', { class: 'muted small', style: 'margin:0 0 12px' }, len + ' letters, six tries.'), grid, parts));
        if (keys) screen.append(keys);
      }

      draw();
    },
  };
})(globalThis.LG = globalThis.LG || {});
