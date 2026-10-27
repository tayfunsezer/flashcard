(function () {
  const st = LG.study;
  T.test('study set queue: misses go to the end, hits finish', () => {
    let set = st.createStudySet({ by: 'category', value: 'A', game: 'cloze' }, ['1', '2', '3'], LG.rng.seeded(7));
    T.eq(set.total, 3);
    T.eq(set.queue.slice().sort(), ['1', '2', '3']);
    const first = st.nextIds(set)[0];
    set = st.recordStudy(set, first, false);
    T.eq(set.queue[set.queue.length - 1], first);
    T.eq(set.done, []);
    while (!st.isFinished(set)) set = st.recordStudy(set, st.nextIds(set)[0], true);
    T.eq(set.done.slice().sort(), ['1', '2', '3']);
    T.eq(st.nextIds(set, 6), []);
  });
  T.test('prune drops ids missing from the dataset and recounts', () => {
    const set = { by: 'category', value: 'A', game: 'cloze', queue: ['1', '2', '3'], total: 5, done: ['4', '5'] };
    const p = st.prune(set, new Set(['1', '3', '4']));
    T.eq(p.queue, ['1', '3']);
    T.eq(p.done, ['4']);
    T.eq(p.total, 3);
    T.eq(p.game, 'cloze');
    T.eq(set.queue.length, 3);
  });
  T.test('prune returns null when nothing is left to study', () => {
    const set = { by: 'category', value: 'A', game: 'mc', queue: ['1'], total: 2, done: ['2'] };
    T.eq(st.prune(set, new Set(['2'])), null);
    T.eq(st.prune(null, new Set(['2'])), null);
  });
})();
