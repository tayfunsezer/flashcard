(function (LG) {
  const { h, clear } = LG.dom;
  const ROUND_SIZE = 10;
  const MAX_HINTS = 3;
  const MESSAGES = { correct: 'Correct', almost: 'Almost — mind the accents: ', wrong: 'Answer: ' };
  const FB_CLASS = { correct: 'fb-ok', almost: 'fb-almost', wrong: 'fb-bad' };

  // Target sentence as text runs and word tokens; `word(tok)` renders each token.
  function sentence(target, lang, word) {
    const out = [];
    let at = 0;
    for (const t of LG.text.tokenize(target, lang)) {
      if (t.index > at) out.push(target.slice(at, t.index));
      out.push(word(t));
      at = t.index + t.text.length;
    }
    if (at < target.length) out.push(target.slice(at));
    return out;
  }

  // Shared header for game screens: title, progress, combo pill, round XP, quit.
  // `done` set: progress counts finished words ("3 / 10 done"); otherwise `pos` is the current prompt.
  function gameHeader(title, { pos, done, total, combo, xp }) {
    const mult = LG.rewards.comboMultiplier(combo);
    return h('div', { class: 'topbar game-head' },
      h('h1', null, title),
      h('div', { class: 'btn-row' },
        done != null
          ? h('span', { class: 'muted', 'aria-label': done + ' of ' + total + ' done' }, done + ' / ' + total + ' done')
          : h('span', { class: 'muted', 'aria-label': 'Prompt ' + pos + ' of ' + total }, pos + ' / ' + total),
        mult > 1 ? h('span', { class: 'pill pill-accent', title: combo + ' in a row' }, '×' + mult) : null,
        h('span', { class: 'pill' }, '+' + xp + ' XP'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => {
          if (window.confirm('Leave this round? Answers so far are kept.')) LG.app.go('home');
        } }, 'Quit')));
  }

  // Per-round answer tracking shared by Cloze, Multiple Choice and Flashcards.
  // Non-study modes walk LG.round: a missed word returns at the end, and only its first answer counts.
  // Study mode keeps the LG.study queue (which already re-queues misses); every answer counts there, as before.
  function roundTracker(mode, ids) {
    const study = mode === 'study';
    let r = LG.round.create(study ? [] : ids);
    const studyFirst = new Map();
    const kept = new Map();
    return {
      current: () => LG.round.current(r),
      // Whether this answer goes through answerPrompt and the tallies.
      counts: (id) => study || LG.round.isFirst(r, id),
      isRepeat: (id) => !study && !LG.round.isFirst(r, id),
      // Records the answer; true when the word has left the round (time to advance Cloze rotation).
      record(id, result) {
        if (study) { if (!studyFirst.has(id)) studyFirst.set(id, result); return true; }
        r = LG.round.record(r, id, result);
        return !r.queue.includes(id);
      },
      skip(id) { if (!study) r = LG.round.drop(r, id); },
      label: () => LG.round.progress(r),
      missed: () => (study ? [...studyFirst].filter(([, v]) => v === 'wrong').map(([id]) => id) : LG.round.missed(r)),
      // Value fixed at a word's first showing (e.g. its blank), reused for its repeats.
      keep(id, make) {
        if (study) return make();
        if (!kept.has(id)) kept.set(id, make());
        return kept.get(id);
      },
    };
  }

  // Returns '' (an empty text node) when hidden: callers pass it to Element.append, which would print null.
  function againTag(show) {
    return show ? h('p', { class: 'again-tag muted small' }, 'Again — you missed this one') : '';
  }

  LG.screens.cloze = {
    gameHeader, sentence, roundTracker, againTag,
    render(root, params) {
      const app = LG.app;
      const lang = app.ctx.langTarget;
      const mode = params.mode || 'review';
      const ids = (params.ids || []).filter((id) => app.ctx.itemsById.has(id));
      const letters = LG.words.specialLetters(app.ctx.items, lang);
      const round = { played: 0, combo: 0, xp: 0, correct: 0, almost: 0, wrong: 0, from: new Map(), touched: [] };
      const track = roundTracker(mode, ids);
      const screen = h('div', { class: 'screen' });
      root.append(screen);
      let onEnter = null;

      if (mode === 'study' ? !app.state.studySet : !ids.length) {
        app.banner('Nothing to play in this round.', 'info');
        return app.go('home');
      }

      const keydown = (e) => {
        if (!screen.isConnected) { document.removeEventListener('keydown', keydown); return; }
        if (e.key !== 'Enter' || !onEnter) return;
        if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('enter-target')) return;
        e.preventDefault();
        onEnter();
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
          game: 'cloze', mode, xp: round.xp, correct: round.correct, almost: round.almost, wrong: round.wrong, moved, missed: track.missed(),
          again: () => app.go('cloze', { ids: app.roundIds('cloze', mode), mode }),
        });
      }

      function prompt() {
        const id = nextId();
        if (!id) return finish();
        const item = app.ctx.itemsById.get(id);
        const blank = track.keep(id, () => LG.words.pickBlank(item, app.state.progress[id], app.ctx.rarity, lang));
        const repeat = track.isRepeat(id);
        const len = LG.text.charLength(blank.text);
        let hints = 0;

        const input = h('input', { type: 'text', class: 'cloze-input', lang, autocomplete: 'off', autocapitalize: 'off',
          spellcheck: 'false', 'aria-label': 'Missing word' });
        const hintLine = h('p', { class: 'hint muted', 'aria-live': 'polite' });
        const hintBtn = h('button', { class: 'btn', type: 'button', onclick: () => {
          hints = Math.min(MAX_HINTS, hints + 1);
          hintLine.textContent = LG.words.hintText(blank.text, hints);
          hintBtn.textContent = hints < MAX_HINTS ? 'Hint (' + (MAX_HINTS - hints) + ' left)' : 'No hints left';
          hintBtn.disabled = hints >= MAX_HINTS;
          input.focus();
        } }, 'Hint (' + MAX_HINTS + ' left)');
        const insert = (ch) => {
          const start = input.selectionStart ?? input.value.length;
          const end = input.selectionEnd ?? start;
          input.setRangeText(ch, start, end, 'end');
          input.focus();
        };
        const letterRow = letters.length ? h('div', { class: 'letters', role: 'group', 'aria-label': 'Special letters' },
          letters.map((ch) => h('button', { class: 'btn btn-small letter', type: 'button', lang,
            onmousedown: (e) => e.preventDefault(), onclick: () => insert(ch) }, ch))) : null;

        const answerLine = h('p', { class: 'sentence', lang }, sentence(item.target, lang, (t) => (t.index === blank.index
          ? h('span', { class: 'blank', style: 'width:' + (len + 1) + 'ch', 'aria-label': 'blank, ' + len + ' letters' }, ' ')
          : t.text)));
        const card = h('div', { class: 'card fb cloze' },
          h('p', { class: 'clue muted', lang: app.ctx.langSource }, item.source),
          answerLine);
        const controls = h('div', { class: 'stack' },
          h('div', { class: 'btn-row' }, input,
            h('button', { class: 'btn btn-primary enter-target', type: 'button', onclick: () => submit() }, 'Submit'),
            hintBtn,
            h('button', { class: 'btn btn-link', type: 'button', onclick: () => submit(true) }, 'Show answer')),
          letterRow, hintLine);

        const label = progressLabel();
        clear(screen).append(gameHeader('Cloze', Object.assign({}, label, { combo: round.combo, xp: round.xp })), againTag(repeat), card, controls);
        input.focus();
        onEnter = () => submit();

        function submit(giveUp) {
          if (!giveUp && !input.value.trim()) { input.focus(); return; }
          const result = giveUp ? 'wrong' : LG.answer.checkAnswer(input.value, blank.text, lang);
          let st = app.state;
          let xp = 0;
          if (track.counts(id)) {
            if (!round.from.has(id)) {
              round.from.set(id, (st.progress[id] && st.progress[id].box) || 0);
              round.touched.push(id);
            }
            const res = LG.play.answerPrompt(st, id, result, { hints }, Date.now(), round.combo);
            st = res.state;
            xp = res.xp;
            round.combo = res.combo;
            round.xp += res.xp;
            round[result] += 1;
          }
          // Repeats blank the same word: rotation moves on once the word has left the round.
          if (track.record(id, result)) st = LG.play.advanceRotation(st, id);
          app.setState(st);
          round.played += 1;
          feedback(result, xp);
        }

        function feedback(result, xp) {
          const next = h('button', { class: 'btn btn-primary enter-target', type: 'button', onclick: () => prompt() }, 'Next');
          const pinBox = h('div', { class: 'pin-row small' });
          const answered = h('p', { class: 'sentence', lang });
          const drawSentence = () => {
            const pin = app.state.progress[id] && app.state.progress[id].pin;
            const pinKey = pin && LG.text.lower(pin, lang);
            clear(answered).append(...sentence(item.target, lang, (t) => {
              const cls = ['word'];
              if (t.index === blank.index) cls.push('word-answer');
              if (pinKey && LG.text.lower(t.text, lang) === pinKey) cls.push('word-pinned');
              return h('button', { class: cls.join(' '), type: 'button', title: 'Blank this word next time',
                onclick: () => { app.setState(LG.play.setPin(app.state, id, t.text)); drawSentence(); } }, t.text);
            }));
            clear(pinBox).append(...(pin
              ? [h('span', null, 'Pinned: ', h('strong', { lang }, pin)),
                h('button', { class: 'btn btn-small', type: 'button', 'aria-label': 'Clear pinned word',
                  onclick: () => { app.setState(LG.play.setPin(app.state, id, null)); drawSentence(); } }, '✕')]
              : [h('span', { class: 'muted' }, 'Click a word to blank it in this sentence next time.')]));
          };
          drawSentence();
          answerLine.replaceWith(answered);
          card.classList.add(FB_CLASS[result]);
          const msg = h('p', { class: 'fb-msg fb-text-' + result, role: 'status' },
            MESSAGES[result], result === 'correct' ? null : h('strong', { lang }, blank.text),
            xp ? h('span', { class: 'muted' }, '  +' + xp + ' XP') : null);
          clear(controls).append(msg, pinBox, h('div', { class: 'btn-row' }, next));
          screen.firstChild.replaceWith(gameHeader('Cloze', Object.assign({}, mode === 'study' ? label : progressLabel(), { combo: round.combo, xp: round.xp })));
          next.focus();
          onEnter = () => prompt();
        }
      }

      prompt();
    },
  };
})(globalThis.LG = globalThis.LG || {});
