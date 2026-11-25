(function (LG) {
  const { h, clear } = LG.dom;
  const MESSAGES = { correct: 'Correct', almost: 'Almost — mind the accents: ', wrong: 'Answer: ' };
  const FB_CLASS = { correct: 'fb-ok', almost: 'fb-almost', wrong: 'fb-bad' };

  // Aspect pairs: one verb of an "X (impf.) & Y (pf.)" row is shown, the learner types the partner.
  // Practice only: XP, combo and streak count, the Leitner box does not move.
  LG.screens.aspect = {
    render(root, params) {
      const app = LG.app;
      const cz = LG.screens.cloze;
      const lang = app.ctx.langTarget;
      const dirMode = params.dir || 'random';
      const mode = params.mode || 'review';
      const guess = dirMode === 'random-guess';
      const ids = (params.ids || []).filter((id) => app.ctx.itemsById.has(id) && app.ctx.aspectIds.has(id));
      const screen = h('div', { class: 'screen' });
      root.append(screen);

      if (!ids.length) {
        app.banner('Nothing to play in this round.', 'info');
        return app.go('home');
      }

      const letters = LG.words.specialLetters(app.ctx.items, lang);
      const round = { combo: 0, xp: 0, correct: 0, almost: 0, wrong: 0, unmarked: new Set(), seen: new Set() };
      const track = cz.roundTracker('review', ids);
      const dirs = LG.aspect.directions(ids, dirMode, Math.random);
      let onEnter = null;

      const keydown = (e) => {
        if (!screen.isConnected) { document.removeEventListener('keydown', keydown); return; }
        if (e.key !== 'Enter' || !onEnter) return;
        if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('enter-target')) return;
        e.preventDefault();
        onEnter();
      };
      document.addEventListener('keydown', keydown);

      const header = () => cz.gameHeader('Aspect pairs', Object.assign({}, track.label(), { combo: round.combo, xp: round.xp }));

      function finish() {
        document.removeEventListener('keydown', keydown);
        app.setState(LG.play.completeRound(app.state, LG.dates.todayISO()));
        app.go('summary', {
          game: 'aspect', mode, xp: round.xp, correct: round.correct, almost: round.almost, wrong: round.wrong, moved: [],
          missed: track.missed(), marked: LG.play.markedIds(Array.from(round.unmarked), app.state.progress), seen: Array.from(round.seen),
          extra: { dir: dirMode },
          again: () => app.go('aspect', { ids: LG.play.startRound(app.roundIds('aspect', mode)), mode, dir: dirMode }),
        });
      }

      function prompt() {
        const id = track.current();
        if (!id) return finish();
        const item = app.ctx.itemsById.get(id);
        const c = track.keep(id, () => LG.aspect.card(item, dirs.get(id), dirMode));
        round.seen.add(id);
        const repeat = track.isRepeat(id);

        const input = h('input', { type: 'text', class: 'cloze-input', lang, autocomplete: 'off', autocapitalize: 'off',
          spellcheck: 'false', 'aria-label': 'Partner verb' });
        const pick = guess ? h('select', { class: 'aspect-pick', 'aria-label': 'Aspect of the shown verb' },
          h('option', { value: '' }, 'Aspect?'), h('option', { value: 'impf.' }, 'impf.'), h('option', { value: 'pf.' }, 'pf.')) : null;
        const insert = (ch) => {
          const start = input.selectionStart ?? input.value.length;
          const end = input.selectionEnd ?? start;
          input.setRangeText(ch, start, end, 'end');
          input.focus();
        };
        const letterRow = letters.length ? h('div', { class: 'letters', role: 'group', 'aria-label': 'Special letters' },
          letters.map((ch) => h('button', { class: 'btn btn-small letter', type: 'button', lang,
            onmousedown: (e) => e.preventDefault(), onclick: () => insert(ch) }, ch))) : null;

        const verbLine = h('p', { class: 'sentence', lang },
          h('strong', null, c.shown),
          c.shownAspect ? h('span', { class: 'muted small aspect-tag' }, ' (' + c.shownAspect + ')') : '',
          c.extras ? ' ' + c.extras : '',
          ' → ',
          h('span', { class: 'blank', style: 'width:' + (LG.aspect.blankLength(c, dirMode) + 1) + 'ch', 'aria-label': 'blank' }, ' '));
        const card = h('div', { class: 'card fb cloze' },
          h('p', { class: 'clue muted', lang: app.ctx.langSource }, c.english),
          verbLine);
        const controls = h('div', { class: 'stack' },
          h('div', { class: 'cloze-field' + (guess ? ' aspect-guess' : '') }, pick || '', input),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn btn-primary enter-target', type: 'button', onclick: () => submit() }, 'Submit'),
            h('button', { class: 'btn btn-link', type: 'button', onclick: () => submit(true) }, 'Show answer')),
          letterRow);

        clear(screen).append(header(), cz.againTag(repeat), card, controls);
        input.focus();
        onEnter = () => submit();

        function submit(giveUp) {
          if (!giveUp && guess && !pick.value) { pick.focus(); return; }
          if (!giveUp && !input.value.trim()) { input.focus(); return; }
          const picked = guess ? pick.value : null;
          const graded = giveUp ? { result: 'wrong', aspectOk: false } : guess ? LG.aspect.gradeGuess(input.value, picked, c, lang)
            : { result: LG.aspect.grade(input.value, c, lang), aspectOk: true };
          const result = graded.result;
          let xp = 0;
          if (track.counts(id)) {
            const res = LG.play.practiceAnswer(app.state, result, round.combo);
            app.setState(res.state);
            xp = res.xp;
            round.combo = res.combo;
            round.xp += res.xp;
            round[result] += 1;
          }
          track.record(id, result);
          feedback(result, xp, giveUp ? '' : input.value.trim(), guess ? { picked, ok: graded.aspectOk } : null);
        }

        function typedWords(typed) {
          const d = LG.answer.diffWords(typed, c.answer, lang);
          const out = [];
          d.typed.forEach((t, i) => {
            if (i) out.push(' ');
            out.push(h('span', { class: 'typed-' + t.status, lang }, t.text));
          });
          d.missing.forEach((w) => out.push(' ', h('span', { class: 'typed-missing', lang, title: 'missing word' }, '‹' + w + '›')));
          return out;
        }

        function feedback(result, xp, typed, aspect) {
          const next = h('button', { class: 'btn btn-primary enter-target', type: 'button', onclick: () => prompt() }, 'Next');
          const star = cz.starButton(id, (_, now) => { if (now) round.unmarked.add(id); });
          card.classList.add(FB_CLASS[result]);
          verbLine.replaceWith(h('p', { class: 'sentence', lang }, LG.aspect.reveal(c)));
          const msg = h('p', { class: 'fb-msg fb-text-' + result, role: 'status' },
            aspect && !aspect.ok && result === 'almost' ? 'Almost \u2014 right verb, wrong aspect: ' : MESSAGES[result], result === 'correct' ? null : h('strong', { lang }, c.answer),
            xp ? h('span', { class: 'muted' }, '  +' + xp + ' XP') : null);
          const typedLine = typed && result !== 'correct' ? h('p', { class: 'typed small muted' }, 'You typed: ', typedWords(typed)) : null;
          const aspectLine = aspect ? h('p', { class: 'small ' + (aspect.ok ? 'muted' : 'fb-text-almost') },
            !aspect.picked ? 'Aspect: ' + c.shownKind + ' (the shown verb)'
              : aspect.ok ? 'Aspect: ' + c.shownKind + ' \u2713' : 'You picked ' + aspect.picked + ', it is ' + c.shownKind + '.') : null;
          clear(controls).append(msg, aspectLine || '', typedLine || '', h('div', { class: 'pin-row small' }, star, LG.speech.button(() => c.impf + ', ' + c.pf + (c.extras ? ' ' + c.extras : ''))), h('div', { class: 'btn-row' }, next));
          screen.firstChild.replaceWith(header());
          next.focus();
          onEnter = () => prompt();
        }
      }

      prompt();
    },
  };
})(globalThis.LG = globalThis.LG || {});
