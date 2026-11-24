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
      const round = { combo: 0, xp: 0, correct: 0, wrong: 0, from: new Map(), before: new Map(), touched: [], unmarked: new Set(), seen: new Set() };
      const track = roundTracker(mode, ids);
      const screen = h('div', { class: 'screen' });
      root.append(screen);
      let onEnter = null;
      let onKey = null;
      let goTo = null;
      let shownId = null;
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
        } else if (e.key === 'ArrowLeft' && goTo) {
          e.preventDefault();
          goTo.back();
        } else if (e.key === 'ArrowRight' && goTo) {
          e.preventDefault();
          goTo.forward();
        } else if (onKey && e.key >= '1' && e.key <= '9') {
          onKey(Number(e.key) - 1);
        }
      };
      document.addEventListener('keydown', keydown);

      function nextId() {
        if (mode === 'study') {
          const set = app.state.studySet;
          if (!set || LG.study.isFinished(set)) return null;
          return track.studyNext(set, skipped);
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
          marked: LG.play.markedIds(Array.from(round.unmarked), app.state.progress), seen: Array.from(round.seen),
          again: () => app.go('mc', { ids: app.roundIds('mc', mode), mode }),
        });
      }

      // Question description for one item: answer, answer language, distractor pool, prompt nodes.
      function build(item, id) {
        const s2t = app.state.settings.direction !== 't2s';
        const whole = app.state.settings.ask === 'whole';
        const own = s2t && item.options && item.options.length ? item.options : null;
        if (!whole && app.ctx.kinds.get(id) === 'sentence' && !own) {
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
          pool: app.ctx.items.filter((it) => it.id !== id && (whole || app.ctx.kinds.get(it.id) !== 'sentence'))
            .map((it) => ({ text: s2t ? it.target : it.source, categories: it.categories })),
          body: h('p', { class: 'sentence', lang: s2t ? langS : langT }, s2t ? item.source : item.target),
        };
      }

      // One entry per word: the question as first shown, its option order, and the answer given (so Back shows the same question).
      const views = new Map();
      let trail = LG.trail.create();

      function makeView(id) {
        const q = build(app.ctx.itemsById.get(id), id);
        let wrong = q.own ? LG.rng.shuffle(q.own.slice(), Math.random).slice(0, OPTIONS - 1) : [];
        if (wrong.length < OPTIONS - 1) {
          wrong = wrong.concat(LG.distractors.pickDistractors(q.answer, q.pool.filter((p) => !wrong.includes(p.text)), q.categories, q.lang, Math.random, OPTIONS - 1 - wrong.length));
        }
        if (wrong.length < OPTIONS - 1) return null;
        // A repeat gets fresh distractors and a fresh shuffle; the answer (and a sentence's blank) stay the same.
        const options = LG.rng.shuffle([q.answer].concat(wrong), Math.random);
        return { q, options, correctIdx: options.indexOf(q.answer), picked: undefined, result: undefined, xp: 0, open: true };
      }

      // Takes the next word from the queue (skipping words that cannot show four options) and shows it.
      function next() {
        let id, v;
        for (;;) {
          id = nextId();
          if (!id) return finish();
          v = makeView(id);
          if (v) break;
          skipped.add(id); // fewer than four distinct options: leave this item out of the round
          track.skip(id);
        }
        views.set(id, v);
        trail = LG.trail.push(trail, id);
        show(id, false);
      }

      function advance() {
        if (LG.trail.canForward(trail)) {
          trail = LG.trail.forward(trail);
          return show(LG.trail.current(trail), true);
        }
        const cur = LG.trail.current(trail);
        if (cur && views.get(cur).picked === undefined) track.defer(cur);
        next();
      }

      function goBack() {
        const t = LG.trail.back(trail);
        if (!t) return;
        trail = t;
        show(LG.trail.current(trail), true);
      }

      // Refresh file keeps this round: edited words are renamed (their question is rebuilt from the new text), gone words
      // leave. The screen is redrawn only when the word on screen was edited or removed.
      app.activeRound = {
        screen,
        onDataset(map, removed) {
          const C = LG.screens.cloze;
          C.remapRound(round, map, removed);
          C.remapMap(views, map, removed, false);
          C.remapMap(skipped, map, removed, false);
          track.remap(map, removed);
          trail = LG.trail.remap(trail, map, removed);
          screen.firstChild.replaceWith(gameHeader('Multiple Choice', Object.assign({}, progressLabel(), { combo: round.combo, xp: round.xp })));
          if (!shownId) return;
          if (removed.has(shownId)) return next();
          if (!map.has(shownId)) return;
          const id = map.get(shownId);
          const v = makeView(id);
          if (!v) { track.skip(id); return next(); }
          views.set(id, v);
          show(id, true);
        },
      };

      function show(id, revisit) {
        const v = views.get(id);
        const q = v.q;
        shownId = id;
        round.seen.add(id);
        if (revisit && v.picked !== undefined) v.open = true; // an answered word can be answered again
        const buttons = v.options.map((text, i) => h('button', { class: 'btn choice', type: 'button', lang: q.lang, onclick: () => choose(i) },
          h('span', { class: 'choice-key', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'choice-text' }, text)));
        const card = h('div', { class: 'card fb mc' }, q.clue || null, q.body);
        const choices = h('div', { class: 'choices', role: 'group', 'aria-label': 'Answer options' }, buttons);
        const foot = h('div', { class: 'stack' });
        const star = LG.screens.cloze.starButton(id, (_, now) => { if (now) round.unmarked.add(id); });
        const header = () => gameHeader('Multiple Choice', Object.assign({}, progressLabel(), { combo: round.combo, xp: round.xp }));
        const navHolder = h('div', null);
        clear(screen).append(header(), againTag(!revisit && v.picked === undefined && track.isRepeat(id)), card, choices, foot, navHolder);

        function paint() {
          const answered = v.picked !== undefined;
          buttons.forEach((b, k) => {
            b.disabled = answered && !v.open;
            b.classList.toggle('choice-correct', answered && k === v.correctIdx);
            b.classList.toggle('choice-wrong', answered && k === v.picked && k !== v.correctIdx);
          });
          card.classList.toggle('fb-ok', answered && v.result === 'correct');
          card.classList.toggle('fb-bad', answered && v.result === 'wrong');
          if (answered && q.solved) card.lastChild.replaceWith(q.solved.cloneNode(true));
          clear(foot).append(
            answered ? h('p', { class: 'fb-msg fb-text-' + v.result, role: 'status' },
              v.result === 'correct' ? 'Correct' : ['Answer: ', h('strong', { lang: q.lang }, q.answer)],
              v.xp ? h('span', { class: 'muted' }, '  +' + v.xp + ' XP') : null) : '',
            h('div', { class: 'btn-row' }, star));
          clear(navHolder).append(LG.screens.cloze.navRow({
            canBack: LG.trail.canBack(trail), onBack: goBack,
            canForward: answered || LG.trail.canForward(trail) || track.canDefer(),
            forwardLabel: answered ? 'Next' : 'Skip', primary: answered, onForward: advance,
          }));
          const fwd = navHolder.querySelector('.nav-forward');
          onEnter = answered && fwd ? () => advance() : null;
          if (answered && fwd && !v.open) fwd.focus();
        }

        function choose(i) {
          if (!v.open) return;
          v.open = false;
          v.picked = i;
          v.result = i === v.correctIdx ? 'correct' : 'wrong';
          const res = LG.screens.cloze.answerWord({ id, result: v.result, revisit, round, track, rotate: q.sentence });
          v.xp = res.xp;
          paint();
          screen.firstChild.replaceWith(header());
        }

        onKey = (i) => { if (i < buttons.length) choose(i); };
        goTo = { back: goBack, forward: () => { const f = navHolder.querySelector('.nav-forward'); if (f && !f.disabled) f.click(); } };
        paint();
      }

      next();
    },
  };
})(globalThis.LG = globalThis.LG || {});
