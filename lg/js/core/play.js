(function (LG) {
  const OPTIONS = 4;

  function withStudy(state, id, ok) {
    const set = state.studySet;
    if (!set || !set.queue.includes(id)) return state.studySet;
    return LG.study.recordStudy(set, id, ok);
  }

  function setProgress(state, id, entry) {
    return Object.assign({}, state.progress, { [id]: entry });
  }

  function answerPrompt(state, itemId, result, opts, nowMs, combo) {
    const hints = (opts && opts.hints) || 0;
    const ok = result !== 'wrong';
    const newCombo = ok ? combo + 1 : 0;
    const xp = Math.round(LG.rewards.promptXp({ result, hints }) * LG.rewards.comboMultiplier(newCombo));
    const next = Object.assign({}, state, {
      progress: setProgress(state, itemId, LG.schedule.applyResult(state.progress[itemId], result, nowMs)),
      xp: state.xp + xp,
      studySet: withStudy(state, itemId, ok),
    });
    return { state: next, xp, combo: newCombo };
  }

  function matchBoard(state, { ids, missedIds, seconds }, nowMs) {
    const progress = Object.assign({}, state.progress);
    let set = state.studySet;
    for (const id of ids) {
      const missed = missedIds.includes(id);
      progress[id] = LG.schedule.applyResult(state.progress[id], missed ? 'wrong' : 'correct', nowMs);
      if (set && set.queue.includes(id)) set = LG.study.recordStudy(set, id, !missed);
    }
    const xp = LG.rewards.matchXp({ pairs: ids.length, misses: missedIds.length, seconds });
    return { state: Object.assign({}, state, { progress, studySet: set, xp: state.xp + xp }), xp };
  }

  function completeRound(state, todayIso) {
    const next = Object.assign({}, state, { streak: LG.rewards.updateStreak(state.streak, todayIso) });
    if (state.studySet && LG.study.isFinished(state.studySet)) next.studySet = null;
    return next;
  }

  function finishDaily(state, todayIso, won) {
    const xp = won ? LG.rewards.DAILY_WIN_XP : 0;
    const next = Object.assign({}, state, {
      daily: Object.assign({}, state.daily, { done: true, won: !!won }),
      streak: LG.rewards.updateStreak(state.streak, todayIso),
      xp: state.xp + xp,
    });
    return { state: next, xp };
  }

  // Partial entries deliberately omit `seen` and `box`: schedule treats them as unseen / box 0.
  function patchEntry(state, id, patch) {
    const e = state.progress[id] || { pin: null, rot: 0 };
    return Object.assign({}, state, { progress: setProgress(state, id, Object.assign({}, e, patch(e))) });
  }

  function setPin(state, itemId, word) {
    return patchEntry(state, itemId, () => ({ pin: word }));
  }

  function advanceRotation(state, itemId) {
    return patchEntry(state, itemId, (e) => ({ rot: (e.rot || 0) + 1 }));
  }

  // mcIds (optional Set, see mcEligibleIds) restricts Multiple Choice to items that can show four options.
  // Flashcards take every item, terms and sentences alike.
  function eligibleIds(items, game, lang, mcIds) {
    if (game === 'flashcards') return items.map(it => it.id);
    return items
      .filter(it => game === 'mc'
        ? !mcIds || mcIds.has(it.id)
        : LG.words.kindOf(it.target, lang) === (game === 'cloze' ? 'sentence' : 'term'))
      .map(it => it.id);
  }

  // Ids Multiple Choice can ask about: terms when the file has >= 4 terms, sentences when its
  // sentences offer >= 4 distinct cloze words (the distractor pools used by the MC screen).
  function mcEligibleIds(items, rarity, lang) {
    const terms = [];
    const sentences = [];
    const withOptions = [];
    const words = new Set();
    for (const it of items) {
      if (LG.words.kindOf(it.target, lang) !== 'sentence') { terms.push(it.id); continue; }
      // A sentence with its own options is asked as a term-style question, so it needs no cloze words.
      (it.options && it.options.length ? withOptions : sentences).push(it.id);
      for (const c of LG.words.clozeCandidates(it.target, rarity, lang)) words.add(LG.text.lower(c.text, lang));
    }
    const ok = new Set((terms.length >= OPTIONS ? terms : []).concat(words.size >= OPTIONS ? sentences : []).concat(withOptions));
    return items.filter(it => ok.has(it.id)).map(it => it.id);
  }

  LG.play = { answerPrompt, matchBoard, completeRound, finishDaily, setPin, advanceRotation, eligibleIds, mcEligibleIds, MC_OPTIONS: OPTIONS };
})(globalThis.LG = globalThis.LG || {});
