(function (LG) {
  const { h, clear } = LG.dom;
  const OPTIONS = LG.play.MC_OPTIONS;

  LG.screens.mc = {
    render(root, params) {
      const app = LG.app;
      const { gameHeader, sentence, roundTracker, againTag } = LG.screens.cloze;
      const langS = app.ctx.langSource;
      const langT = app.ctx.langTarget;
      const mode = params.mode || 'review';
      const ids = (params.ids || []).filter((id) => app.ctx.itemsById.has(id));
      const round = { combo: 0, xp: 0, correct: 0, wrong: 0, from: new Map(), touched: [] };
      const track = roundTracker(mode, ids);
      const screen = h('div', { class: 'screen' });
      root.append(screen);
      let onEnter = null;
      let onKey = null;
      const skipped = new Set();

      if (mode === 'study' ? !app.state.studySet : !ids.length) {
        app.banner('Nothing to play in this round.', 'info');
        return app.go('home');
      }

      const keydown = (e) => {
        if (!screen.isConnected) { document.removeEventListener('keydown', keydown); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Enter') {
          if (!onEnter) return;
          if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('enter-target')) return;
          e.preventDefault();
          onEnter();
        } else if (onKey && e.key >= '1' && e.key <= '9') {
          onKey(Number(e.key) - 1);
        }
      };
      document.addEventListener('keydown', keydown);

      function nextId() {
        if (mode === 'study') {
          const set = app.state.studySet;
          if (!set || LG.study.isFinished(set)) return null;
          return set.queue.find((id) => !skipped.has(id)) || null;
        }
        return track.current();
      }

      function progressLabel() {
        if (mode === 'study') {
          const set = app.state.studySet;
          return { pos: set.total - set.queue.length + 1, total: set.total };
        }
        return track.label();
      }

      function finish() {
        document.removeEventListener('keydown', keydown);
        app.setState(LG.play.completeRound(app.state, LG.dates.todayISO()));
        const moved = round.touched
          .map((id) => ({ id, from: round.from.get(id), to: app.state.progress[id].box }))
          .filter((m) => m.from !== m.to);
        app.go('summary', {
          game: 'mc', mode, xp: round.xp, correct: round.correct, almost: 0, wrong: round.wrong, moved, missed: track.missed(),
          again: () => app.go('mc', { ids: app.roundIds('mc', mode), mode }),
        });
      }

      // Question description for one item: answer, answer language, distractor pool, prompt nodes.
      function build(item, id) {
        const s2t = app.state.settings.direction !== 't2s';
        const own = s2t && item.options && item.options.length ? item.options : null;
        if (app.ctx.kinds.get(id) === 'sentence' && !own) {
          const blank = track.keep(id, () => LG.words.pickBlank(item, app.state.progress[id], app.ctx.rarity, langT));
          const pool = [];
          for (const it of app.ctx.items) {
            if (it.id === id || app.ctx.kinds.get(it.id) !== 'sentence') continue;
            for (const c of LG.words.clozeCandidates(it.target, app.ctx.rarity, langT)) pool.push({ text: c.text, categories: it.categories });
          }
          const len = LG.text.charLength(blank.text);
          const line = (fill) => h('p', { class: 'sentence', lang: langT }, sentence(item.target, langT, (t) => {
            if (t.index !== blank.index) return t.text;
            return fill ? h('strong', { class: 'word-answer' }, t.text)
              : h('span', { class: 'blank', style: 'width:' + (len + 1) + 'ch', 'aria-label': 'blank, ' + len + ' letters' }, ' ');
          }));
          // Sentence-initial or capitalised answers: every option is capitalised, else all are lower-case.
          const caps = blank.index === 0 || LG.text.matchCase(blank.text, 'A', langT) === blank.text;
          const cased = (w) => LG.text.matchCase(w, caps ? 'A' : 'a', langT);
          return {
            answer: cased(blank.text), lang: langT, pool: pool.map((p) => ({ text: cased(p.text), categories: p.categories })), categories: item.categories, sentence: true,
            clue: h('p', { class: 'clue muted', lang: langS }, item.source), body: line(false), solved: line(true),
          };
        }
        return {
          own, answer: s2t ? item.target : item.source, lang: s2t ? langT : langS, categories: item.categories, sentence: false,
          pool: app.ctx.items.filter((it) => app.ctx.kinds.get(it.id) !== 'sentence')
            .map((it) => ({ text: s2t ? it.target : it.source, categories: it.categories })),
          body: h('p', { class: 'sentence', lang: s2t ? langS : langT }, s2t ? item.source : item.target),
        };
      }

      function prompt() {
        let id, q, wrong;
        for (;;) {
          id = nextId();
          if (!id) return finish();
          q = build(app.ctx.itemsById.get(id), id);
          wrong = q.own ? LG.rng.shuffle(q.own.slice(), Math.random).slice(0, OPTIONS - 1) : [];
          if (wrong.length < OPTIONS - 1) {
            wrong = wrong.concat(LG.distractors.pickDistractors(q.answer, q.pool.filter((p) => !wrong.includes(p.text)), q.categories, q.lang, Math.random, OPTIONS - 1 - wrong.length));
          }
          if (wrong.length >= OPTIONS - 1) break;
          skipped.add(id); // fewer than four distinct options: leave this item out of the round
          track.skip(id);
        }
        const repeat = track.isRepeat(id);
        // A repeat gets fresh distractors and a fresh shuffle; the answer (and a sentence's blank) stay the same.
        const options = LG.rng.shuffle([q.answer].concat(wrong), Math.random);
        const correctIdx = options.indexOf(q.answer);
        const buttons = options.map((text, i) => h('button', { class: 'btn choice', type: 'button', lang: q.lang, onclick: () => choose(i) },
          h('span', { class: 'choice-key', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'choice-text' }, text)));

        const card = h('div', { class: 'card fb mc' }, q.clue || null, q.body);
        const choices = h('div', { class: 'choices', role: 'group', 'aria-label': 'Answer options' }, buttons);
        const foot = h('div', { class: 'stack' });
        const label = progressLabel();
        clear(screen).append(gameHeader('Multiple Choice', Object.assign({}, label, { combo: round.combo, xp: round.xp })), againTag(repeat), card, choices, foot);
        onEnter = null;
        onKey = (i) => { if (i < buttons.length) choose(i); };

        function choose(i) {
          onKey = null;
          const result = i === correctIdx ? 'correct' : 'wrong';
          let st = app.state;
          let xp = 0;
          if (track.counts(id)) {
            if (!round.from.has(id)) {
              round.from.set(id, (st.progress[id] && st.progress[id].box) || 0);
              round.touched.push(id);
            }
            const res = LG.play.answerPrompt(st, id, result, { hints: 0 }, Date.now(), round.combo);
            st = res.state;
            xp = res.xp;
            round.combo = res.combo;
            round.xp += res.xp;
            round[result] += 1;
          }
          if (track.record(id, result) && q.sentence) st = LG.play.advanceRotation(st, id);
          app.setState(st);

          buttons.forEach((b, k) => {
            b.disabled = true;
            if (k === correctIdx) b.classList.add('choice-correct');
            else if (k === i) b.classList.add('choice-wrong');
          });
          card.classList.add(result === 'correct' ? 'fb-ok' : 'fb-bad');
          if (q.solved) card.lastChild.replaceWith(q.solved);
          const next = h('button', { class: 'btn btn-primary enter-target', type: 'button', onclick: () => prompt() }, 'Next');
          clear(foot).append(
            h('p', { class: 'fb-msg fb-text-' + result, role: 'status' },
              result === 'correct' ? 'Correct' : ['Answer: ', h('strong', { lang: q.lang }, q.answer)],
              xp ? h('span', { class: 'muted' }, '  +' + xp + ' XP') : null),
            h('div', { class: 'btn-row' }, next));
          screen.firstChild.replaceWith(gameHeader('Multiple Choice', Object.assign({}, mode === 'study' ? label : progressLabel(), { combo: round.combo, xp: round.xp })));
          next.focus();
          onEnter = () => prompt();
        }
      }

      prompt();
    },
  };
})(globalThis.LG = globalThis.LG || {});
