(function () {
  const P = LG.play, S = LG.state;
  T.test('answerPrompt: schedule, combo, xp', () => {
    let r = P.answerPrompt(S.defaultState(), 'a', 'correct', { hints: 0 }, 0, 4);
    T.eq([r.combo, r.xp, r.state.xp, r.state.progress.a.box], [5, 15, 15, 1]);
    r = P.answerPrompt(r.state, 'a', 'wrong', {}, 0, r.combo);
    T.eq([r.combo, r.xp, r.state.progress.a.revenge], [0, 0, true]);
  });
  T.test('answerPrompt updates an active study set', () => {
    const st = S.defaultState();
    st.studySet = LG.study.createStudySet({ by: 'date', value: '2025-12-13', game: 'cloze' }, ['a'], LG.rng.seeded(1));
    const r = P.answerPrompt(st, 'a', 'almost', {}, 0, 0);
    T.ok(LG.study.isFinished(r.state.studySet));
    T.eq(P.completeRound(r.state, '2025-12-13').studySet, null);
  });
  T.test('study set ignores ids already done or outside the set', () => {
    const st = S.defaultState();
    st.studySet = LG.study.createStudySet({ by: 'date', value: 'x', game: 'cloze' }, ['a', 'b'], LG.rng.seeded(1));
    let r = P.answerPrompt(st, 'a', 'correct', {}, 0, 0);
    const before = r.state.studySet;
    T.eq(before.done, ['a']);
    for (const res of ['wrong', 'correct']) {
      const s2 = P.answerPrompt(r.state, 'a', res, {}, 0, 0).state.studySet;
      T.eq([s2.queue, s2.done], [before.queue, before.done]);
      const s3 = P.matchBoard(r.state, { ids: ['a', 'z'], missedIds: res === 'wrong' ? ['a', 'z'] : [], seconds: 60 }, 0).state.studySet;
      T.eq([s3.queue, s3.done], [before.queue, before.done]);
    }
  });
  T.test('matchBoard', () => {
    const r = P.matchBoard(S.defaultState(), { ids: ['a', 'b'], missedIds: ['b'], seconds: 60 }, 0);
    T.eq(r.state.progress.a.box, 1);
    T.eq(r.state.progress.b.revenge, true);
    T.eq(r.xp, 8);
  });
  T.test('finishDaily leaves progress alone', () => {
    const r = P.finishDaily(S.defaultState(), '2025-12-13', true);
    T.eq([r.xp, r.state.daily.won, r.state.streak.current], [30, true, 1]);
    T.eq(r.state.progress, {});
  });
  T.test('pins and rotation', () => {
    let st = P.setPin(S.defaultState(), 'a', 'kedi');
    T.eq(st.progress.a.pin, 'kedi');
    st = P.advanceRotation(st, 'a');
    T.eq(st.progress.a.rot, 1);
    T.eq(P.setPin(st, 'a', null).progress.a.pin, null);
  });
  T.test('eligibleIds', () => {
    const its = [{ id: 's', target: 'Bugün hava çok güzel' }, { id: 't', target: 'kedi' }];
    T.eq(P.eligibleIds(its, 'cloze', 'tr'), ['s']);
    T.eq(P.eligibleIds(its, 'match', 'tr'), ['t']);
    T.eq(P.eligibleIds(its, 'mc', 'tr'), ['s', 't']);
    T.eq(P.eligibleIds(its, 'flashcards', 'tr'), ['s', 't']);
  });
  T.test('mcEligibleIds: terms need 4 terms; sentences need 4 distinct cloze words', () => {
    const term = (id, w) => ({ id, target: w, categories: ['A'] });
    const sent = (id, w) => ({ id, target: w, categories: ['A'] });
    const rarity = (its) => LG.words.buildRarity(its, 'en');
    let its = [term('a', 'cat'), term('b', 'dog'), term('c', 'bird')];
    T.eq(P.mcEligibleIds(its, rarity(its), 'en'), []);
    its = its.concat([term('d', 'fish')]);
    T.eq(P.mcEligibleIds(its, rarity(its), 'en'), ['a', 'b', 'c', 'd']);
    const s1 = sent('s1', 'the quick brown foxes jumped'), s2 = sent('s2', 'lazy sleepy dogs rested quietly');
    its = [term('a', 'cat'), s1, s2];
    T.eq(P.mcEligibleIds(its, rarity(its), 'en'), ['s1', 's2']);
    const lean = [s1, term('a', 'cat')];
    T.eq(P.mcEligibleIds(lean, rarity(lean), 'en'), []);
    its = [term('a', 'cat'), term('b', 'dog'), term('c', 'bird'), term('d', 'fish'), s1];
    T.eq(P.mcEligibleIds(its, rarity(its), 'en'), ['a', 'b', 'c', 'd']);
  });
  T.test('eligibleIds restricts mc to the given set', () => {
    const its = [{ id: 's', target: 'Bugün hava çok güzel' }, { id: 't', target: 'kedi' }];
    T.eq(P.eligibleIds(its, 'mc', 'tr', new Set(['t'])), ['t']);
    T.eq(P.eligibleIds(its, 'cloze', 'tr', new Set(['t'])), ['s']);
  });
  T.test('mcEligibleIds: a sentence with its own options counts without cloze words', () => {
    const s = { id: 's', target: 'jedno dwa trzy cztery pięć', categories: ['A'], options: ['x y z w', 'a b c d', 'e f g h'] };
    const bare = { id: 'b', target: 'jedno dwa trzy cztery pięć', categories: ['A'] };
    const its = [s, bare];
    T.eq(P.mcEligibleIds(its, LG.words.buildRarity(its, 'pl'), 'pl'), ['s']);
  });
})();
