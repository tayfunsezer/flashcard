(function (LG) {
  const { h, clear } = LG.dom;
  const ROUND_SIZE = 10;

  LG.screens.flashcards = {
    render(root, params) {
      const app = LG.app;
      const { gameHeader, roundTracker, againTag } = LG.screens.cloze;
      const langS = app.ctx.langSource;
      const langT = app.ctx.langTarget;
      const mode = params.mode || 'review';
      const ids = (params.ids || []).filter((id) => app.ctx.itemsById.has(id));
      const round = { played: 0, combo: 0, xp: 0, correct: 0, wrong: 0, from: new Map(), touched: [] };
      const track = roundTracker(mode, ids);
      const screen = h('div', { class: 'screen' });
      root.append(screen);
      let onFlip = null;
      let onGrade = null;

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
          if (t && t.tagName === 'BUTTON' && !t.closest('.fc-area')) return;
          e.preventDefault();
          if (onFlip) onFlip();
        } else if (onGrade && (e.key === '1' || e.key === '2')) {
          e.preventDefault();
          onGrade(e.key === '2' ? 'correct' : 'wrong');
        }
      };
      document.addEventListener('keydown', keydown);

      function nextId() {
        if (mode === 'study') {
          const set = app.state.studySet;
          if (!set || LG.study.isFinished(set) || round.played >= ROUND_SIZE) return null;
          return LG.study.nextIds(set)[0];
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
          again: () => app.go('flashcards', { ids: app.roundIds('flashcards', mode), mode }),
        });
      }

      function prompt() {
        const id = nextId();
        if (!id) return finish();
        const item = app.ctx.itemsById.get(id);
        const s2t = app.state.settings.direction !== 't2s';
        const side = (text, lang, cls) => h('p', { class: 'fc-text ' + cls, lang }, text);
        const front = s2t ? side(item.source, langS, 'fc-front') : side(item.target, langT, 'fc-front');
        const back = s2t ? side(item.target, langT, 'fc-back') : side(item.source, langS, 'fc-back');
        let flipped = false;

        // Clicking the card is a mouse shortcut; the Show answer button and Space cover the keyboard.
        const card = h('div', { class: 'card fc-card', onclick: () => flip() }, front);
        const showBtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => flip() },
          'Show answer', h('span', { class: 'key-hint', 'aria-hidden': 'true' }, 'Space'));
        const controls = h('div', { class: 'fc-controls' }, showBtn);
        const label = progressLabel();
        clear(screen).append(
          gameHeader('Flashcards', Object.assign({}, label, { combo: round.combo, xp: round.xp })),
          againTag(track.isRepeat(id)),
          h('div', { class: 'fc-area' }, card, controls));
        showBtn.focus();
        onFlip = () => flip();
        onGrade = null;

        function flip() {
          if (flipped) return;
          flipped = true;
          onFlip = null;
          card.classList.add('fc-flipped');
          card.append(h('hr', { class: 'fc-rule' }), back);
          const knew = h('button', { class: 'btn fc-grade fc-knew', type: 'button', onclick: () => grade('correct') },
            h('span', { class: 'choice-key', 'aria-hidden': 'true' }, '2'), 'Knew it');
          const missed = h('button', { class: 'btn fc-grade fc-missed', type: 'button', onclick: () => grade('wrong') },
            h('span', { class: 'choice-key', 'aria-hidden': 'true' }, '1'), "Didn't know");
          clear(controls).append(h('div', { class: 'fc-grades', role: 'group', 'aria-label': 'Did you know it?' }, missed, knew));
          knew.focus();
          onGrade = grade;
        }

        function grade(result) {
          onGrade = null;
          if (track.counts(id)) {
            if (!round.from.has(id)) {
              round.from.set(id, (app.state.progress[id] && app.state.progress[id].box) || 0);
              round.touched.push(id);
            }
            const res = LG.play.answerPrompt(app.state, id, result, { hints: 0 }, Date.now(), round.combo);
            app.setState(res.state);
            round.combo = res.combo;
            round.xp += res.xp;
            round[result] += 1;
          }
          track.record(id, result);
          round.played += 1;
          prompt();
        }
      }

      prompt();
    },
  };
})(globalThis.LG = globalThis.LG || {});
