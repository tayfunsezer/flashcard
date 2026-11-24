(function (LG) {
  const { h, clear } = LG.dom;

  LG.screens.flashcards = {
    render(root, params) {
      const app = LG.app;
      const { gameHeader, roundTracker, againTag, starButton } = LG.screens.cloze;
      const langS = app.ctx.langSource;
      const langT = app.ctx.langTarget;
      const mode = params.mode || 'review';
      const ids = (params.ids || []).filter((id) => app.ctx.itemsById.has(id));
      const round = { combo: 0, xp: 0, correct: 0, wrong: 0, from: new Map(), before: new Map(), touched: [], unmarked: new Set(), seen: new Set() };
      const track = roundTracker(mode, ids);
      const screen = h('div', { class: 'screen' });
      root.append(screen);
      let onFlip = null;
      let onGrade = null;
      let goTo = null;
      let shownId = null;

      if (mode === 'study' ? !app.state.studySet : !ids.length) {
        app.banner('Nothing to play in this round.', 'info');
        return app.go('home');
      }

      const keydown = (e) => {
        if (!screen.isConnected) { document.removeEventListener('keydown', keydown); return; }
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target;
        if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
        if (e.key === ' ') {
          // Buttons outside the card area (Quit) keep their native Space behaviour.
          if (t && t.tagName === 'BUTTON' && (!t.closest('.fc-area') || t.classList.contains('star-btn'))) return;
          e.preventDefault();
          if (onFlip) onFlip();
        } else if (goTo && e.key === 'ArrowLeft') {
          e.preventDefault();
          goTo.back();
        } else if (goTo && e.key === 'ArrowRight') {
          e.preventDefault();
          goTo.forward();
        } else if (onGrade && (e.key === '1' || e.key === '2')) {
          e.preventDefault();
          onGrade(e.key === '2' ? 'correct' : 'wrong');
        }
      };
      document.addEventListener('keydown', keydown);

      function nextId() {
        if (mode === 'study') {
          const set = app.state.studySet;
          if (!set || LG.study.isFinished(set)) return null;
          return track.studyNext(set);
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
          game: 'flashcards', mode, xp: round.xp, correct: round.correct, almost: 0, wrong: round.wrong, moved, missed: track.missed(),
          marked: LG.play.markedIds(Array.from(round.unmarked), app.state.progress), seen: Array.from(round.seen),
          again: () => app.go('flashcards', { ids: app.roundIds('flashcards', mode), mode }),
        });
      }

      // One entry per word: whether it was flipped and the grade given (so Back shows the same card).
      const views = new Map();
      let trail = LG.trail.create();

      function next() {
        const id = nextId();
        if (!id) return finish();
        views.set(id, { flipped: false, grade: undefined });
        trail = LG.trail.push(trail, id);
        show(id, false);
      }

      function advance() {
        if (LG.trail.canForward(trail)) {
          trail = LG.trail.forward(trail);
          return show(LG.trail.current(trail), true);
        }
        const cur = LG.trail.current(trail);
        if (cur && views.get(cur).grade === undefined) track.defer(cur);
        next();
      }

      function goBack() {
        const t = LG.trail.back(trail);
        if (!t) return;
        trail = t;
        show(LG.trail.current(trail), true);
      }

      // Refresh file keeps this round: edited words are renamed (the card is redrawn with the new text), gone words
      // leave. The screen is redrawn only when the word on screen was edited or removed.
      app.activeRound = {
        screen,
        onDataset(map, removed) {
          const C = LG.screens.cloze;
          C.remapRound(round, map, removed);
          C.remapMap(views, map, removed, true);
          track.remap(map, removed);
          trail = LG.trail.remap(trail, map, removed);
          screen.firstChild.replaceWith(gameHeader('Flashcards', Object.assign({}, progressLabel(), { combo: round.combo, xp: round.xp })));
          if (!shownId) return;
          if (removed.has(shownId)) return next();
          if (map.has(shownId)) show(map.get(shownId), true);
        },
      };

      // Small lines from Claude's answers (Ask Claude screen) under the answer: an example sentence, the aspect pair.
      function claudeNotes(id) {
        const e = app.notes && app.notes.byId[id];
        if (!e) return null;
        const lines = [];
        if (e.examples) lines.push(h('p', { class: 'fc-note', lang: langT }, e.examples.sentence, h('span', { class: 'muted' }, ' \u2014 ' + e.examples.translation)));
        if (e.aspect) lines.push(h('p', { class: 'fc-note', lang: langT }, LG.claude.formatResult('aspect', e.aspect)));
        return lines.length ? h('div', { class: 'fc-notes' }, lines) : null;
      }

      function show(id, revisit) {
        const v = views.get(id);
        shownId = id;
        round.seen.add(id);
        const item = app.ctx.itemsById.get(id);
        const s2t = app.state.settings.direction !== 't2s';
        const side = (text, lang, cls) => h('p', { class: 'fc-text ' + cls, lang }, text);
        const front = s2t ? side(item.source, langS, 'fc-front') : side(item.target, langT, 'fc-front');
        const back = s2t ? side(item.target, langT, 'fc-back') : side(item.source, langS, 'fc-back');

        // Clicking the card is a mouse shortcut; the Show answer button and Space cover the keyboard.
        const card = h('div', { class: 'card fc-card', onclick: () => flip() }, front);
        const controls = h('div', { class: 'fc-controls' });
        const area = h('div', { class: 'fc-area' }, card, controls);
        const navHolder = h('div', null);
        const header = () => gameHeader('Flashcards', Object.assign({}, progressLabel(), { combo: round.combo, xp: round.xp }));
        clear(screen).append(header(), againTag(!revisit && v.grade === undefined && track.isRepeat(id)), area, navHolder);

        function nav() {
          const answered = v.grade !== undefined;
          clear(navHolder).append(LG.screens.cloze.navRow({
            canBack: LG.trail.canBack(trail), onBack: goBack,
            canForward: answered || LG.trail.canForward(trail) || track.canDefer(),
            forwardLabel: answered ? 'Next' : 'Skip', onForward: advance,
          }));
          goTo = { back: goBack, forward: () => { const f = navHolder.querySelector('.nav-forward'); if (f && !f.disabled) f.click(); } };
        }

        function showFront() {
          const showBtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => flip() },
            'Show answer', h('span', { class: 'key-hint', 'aria-hidden': 'true' }, 'Space'));
          clear(controls).append(showBtn, starButton(id, (_, now) => { if (now) round.unmarked.add(id); }));
          showBtn.focus();
          onFlip = () => flip();
          onGrade = null;
        }

        function flip() {
          if (v.flipped && card.classList.contains('fc-flipped')) return;
          v.flipped = true;
          onFlip = null;
          card.classList.add('fc-flipped');
          card.append(h('hr', { class: 'fc-rule' }), back, claudeNotes(id));
          const pressed = (r) => (v.grade !== undefined && (v.grade === 'wrong') === (r === 'wrong') ? 'true' : 'false');
          const knew = h('button', { class: 'btn fc-grade fc-knew', type: 'button', 'aria-pressed': pressed('correct'), onclick: () => grade('correct') },
            h('span', { class: 'choice-key', 'aria-hidden': 'true' }, '2'), 'Knew it');
          const missed = h('button', { class: 'btn fc-grade fc-missed', type: 'button', 'aria-pressed': pressed('wrong'), onclick: () => grade('wrong') },
            h('span', { class: 'choice-key', 'aria-hidden': 'true' }, '1'), "Didn't know");
          clear(controls).append(h('div', { class: 'fc-grades', role: 'group', 'aria-label': 'Did you know it?' }, missed, knew),
            starButton(id, (_, now) => { if (now) round.unmarked.add(id); }));
          if (!revisit || v.grade === undefined) knew.focus();
          onGrade = grade;
        }

        function grade(result) {
          onGrade = null;
          LG.screens.cloze.answerWord({ id, result, revisit, round, track });
          v.grade = result;
          screen.firstChild.replaceWith(header());
          advance();
        }

        nav();
        if (v.flipped) flip(); else showFront();
      }

      next();
    },
  };
})(globalThis.LG = globalThis.LG || {});
