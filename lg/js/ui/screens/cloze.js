(function (LG) {
  const { h, clear } = LG.dom;
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

  // "boję … się": pinned words in sentence order, joined by a space when adjacent, " … " otherwise.
  function pinLabel(pin, tokens) {
    const hits = LG.words.resolvePins(pin, tokens, LG.app.ctx.langTarget);
    if (!hits) return pin.join(' … ');
    let out = '';
    hits.forEach((hit, i) => {
      if (i) {
        const prev = tokens.findIndex((t) => t.index === hits[i - 1].index);
        out += tokens[prev + 1] && tokens[prev + 1].index === hit.index ? ' ' : ' … ';
      }
      out += hit.text;
    });
    return out;
  }

  LG.screens.cloze = {
    gameHeader, sentence, roundTracker, againTag,
    render(root, params) {
      const app = LG.app;
      const lang = app.ctx.langTarget;
      const mode = params.mode || 'review';
      const ids = (params.ids || []).filter((id) => app.ctx.itemsById.has(id));
      const letters = LG.words.specialLetters(app.ctx.items, lang);
      const round = { combo: 0, xp: 0, correct: 0, almost: 0, wrong: 0, from: new Map(), touched: [], unmarked: new Set() };
      const track = roundTracker(mode, ids);
      const screen = h('div', { class: 'screen' });
      root.append(screen);
      let onEnter = null;
      const skipped = new Set();

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
          if (!set || LG.study.isFinished(set)) return null;
          return set.queue.find((x) => !skipped.has(x)) || null;
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
          marked: LG.play.markedIds(Array.from(round.unmarked), app.state.progress),
          again: () => app.go('cloze', { ids: app.roundIds('cloze', mode), mode }),
        });
      }

      function prompt() {
        let id, item, blanks;
        for (;;) {
          id = nextId();
          if (!id) return finish();
          item = app.ctx.itemsById.get(id);
          blanks = track.keep(id, () => LG.words.pickBlanks(item, app.state.progress[id], app.ctx.rarity, lang));
          if (blanks.length) break;
          skipped.add(id); // no word to blank (e.g. punctuation only): leave this item out of the round
          track.skip(id);
        }
        const repeat = track.isRepeat(id);
        const expected = blanks.map((b) => b.text).join(' ');
        const multi = blanks.length > 1;
        let hints = 0;

        const input = h('input', { type: 'text', class: 'cloze-input', lang, autocomplete: 'off', autocapitalize: 'off',
          spellcheck: 'false', 'aria-label': multi ? 'Missing words' : 'Missing word' });
        const hintLine = h('p', { class: 'hint muted', 'aria-live': 'polite' });
        const hintBtn = h('button', { class: 'btn', type: 'button', onclick: () => {
          hints = Math.min(MAX_HINTS, hints + 1);
          hintLine.textContent = LG.words.hintText(expected, hints);
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

        const answerLine = h('p', { class: 'sentence', lang }, sentence(item.target, lang, (t) => {
          const b = blanks.find((x) => x.index === t.index);
          if (!b) return t.text;
          const len = LG.text.charLength(b.text);
          return h('span', { class: 'blank', style: 'width:' + (len + 1) + 'ch', 'aria-label': 'blank, ' + len + ' letters' }, ' ');
        }));
        const card = h('div', { class: 'card fb cloze' },
          h('p', { class: 'clue muted', lang: app.ctx.langSource }, item.source),
          answerLine);
        const controls = h('div', { class: 'stack' },
          h('div', { class: 'btn-row' }, input,
            h('button', { class: 'btn btn-primary enter-target', type: 'button', onclick: () => submit() }, 'Submit'),
            hintBtn,
            h('button', { class: 'btn btn-link', type: 'button', onclick: () => submit(true) }, 'Show answer')),
          multi ? h('p', { class: 'muted small multi-note' }, 'Type all ' + blanks.length + ' missing words in order') : null,
          letterRow, hintLine);

        const label = progressLabel();
        clear(screen).append(gameHeader('Cloze', Object.assign({}, label, { combo: round.combo, xp: round.xp })), againTag(repeat), card, controls);
        input.focus();
        onEnter = () => submit();

        function submit(giveUp) {
          if (!giveUp && !input.value.trim()) { input.focus(); return; }
          const result = giveUp ? 'wrong' : LG.answer.checkAnswer(input.value, expected, lang);
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
          feedback(result, xp, giveUp ? '' : input.value.trim());
        }

        function feedback(result, xp, typed) {
          const next = h('button', { class: 'btn btn-primary enter-target', type: 'button', onclick: () => prompt() }, 'Next');
          const pinBox = h('div', { class: 'pin-row small' });
          const answered = h('p', { class: 'sentence', lang });
          // Remembers an item that was unmarked before this change: if it ends marked, it was marked this round.
          const noteUnmarked = () => { if (!LG.play.isMarked(app.state.progress[id])) round.unmarked.add(id); };
          const drawSentence = () => {
            const pin = LG.words.pinWords(app.state.progress[id] && app.state.progress[id].pin);
            const pinKeys = new Set(pin.map((w) => LG.text.lower(w, lang)));
            const tokens = LG.text.tokenize(item.target, lang);
            clear(answered).append(...sentence(item.target, lang, (t) => {
              const cls = ['word'];
              if (blanks.some((b) => b.index === t.index)) cls.push('word-answer');
              if (pinKeys.has(LG.text.lower(t.text, lang))) cls.push('word-pinned');
              return h('button', { class: cls.join(' '), type: 'button', title: 'Blank this word next time (click more words to blank an expression)',
                onclick: () => { noteUnmarked(); app.setState(LG.play.togglePinWord(app.state, id, t.text, tokens, lang)); drawSentence(); } }, t.text);
            }));
            clear(pinBox).append(...(pin.length
              ? [h('span', null, 'Pinned: ', h('strong', { lang }, pinLabel(pin, tokens))),
                h('button', { class: 'btn btn-small', type: 'button', 'aria-label': 'Clear pinned words',
                  onclick: () => { app.setState(LG.play.setPin(app.state, id, null)); drawSentence(); } }, '✕')]
              : [h('span', { class: 'muted' }, 'Click a word to blank it in this sentence next time.')]));
          };
          drawSentence();
          answerLine.replaceWith(answered);
          card.classList.add(FB_CLASS[result]);
          const msg = h('p', { class: 'fb-msg fb-text-' + result, role: 'status' },
            MESSAGES[result], result === 'correct' ? null : h('strong', { lang }, expected),
            xp ? h('span', { class: 'muted' }, '  +' + xp + ' XP') : null);
          const typedLine = typed && result !== 'correct'
            ? h('p', { class: 'typed small muted' }, 'You typed: ', h('span', { class: 'typed-' + result, lang }, typed)) : null;
          clear(controls).append(msg, typedLine || '', pinBox, h('div', { class: 'btn-row' }, next));
          screen.firstChild.replaceWith(gameHeader('Cloze', Object.assign({}, mode === 'study' ? label : progressLabel(), { combo: round.combo, xp: round.xp })));
          next.focus();
          onEnter = () => prompt();
        }
      }

      prompt();
    },
  };
})(globalThis.LG = globalThis.LG || {});
