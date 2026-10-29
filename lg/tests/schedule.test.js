(function () {
  const s = LG.schedule, D = s.DAY_MS;
  T.test('applyResult moves boxes and sets due', () => {
    T.eq(s.applyResult(undefined, 'correct', 0), { box: 1, due: D, revenge: false, seen: true, pin: null, rot: 0 });
    T.eq(s.applyResult({ box: 3, due: 0, revenge: false, seen: true, pin: 'x', rot: 2 }, 'wrong', 5),
      { box: 0, due: 5, revenge: true, seen: true, pin: 'x', rot: 2 });
    T.eq(s.applyResult({ box: 1, due: 0, revenge: true, seen: true, pin: null, rot: 0 }, 'almost', 0).box, 2);
    T.eq(s.applyResult({ box: 5, due: 0, revenge: false, seen: true, pin: null, rot: 0 }, 'correct', 0).due, 30 * D);
  });
  T.test('applyResult handles partial entry', () => {
    T.eq(s.applyResult({ pin: 'x', rot: 0 }, 'correct', 0), { box: 1, due: D, revenge: false, seen: true, pin: 'x', rot: 0 });
  });
  T.test('buildReviewRound order', () => {
    const p = { a: { box: 2, due: 10, seen: true }, b: { box: 0, due: 20, seen: true }, d: { box: 3, due: 9e15, seen: true } };
    T.eq(s.buildReviewRound(['a', 'b', 'c', 'd'], p, 100, 4, LG.rng.seeded(1)), ['b', 'a', 'c', 'd']);
    T.eq(s.buildReviewRound(['a', 'b', 'c', 'd'], p, 100, 2, LG.rng.seeded(1)), ['b', 'a']);
  });
  T.test('buildReviewRound with n = Infinity returns every id', () => {
    const ids = Array.from({ length: 25 }, (_, i) => 'i' + i);
    T.eq(LG.schedule.buildReviewRound(ids, {}, 0, Infinity, LG.rng.seeded(2)).length, 25);
    T.eq(LG.schedule.buildReviewRound(ids, {}, 0, undefined, LG.rng.seeded(2)).length, 25);
  });
  T.test('buildReviewRound treats entry without seen as unseen', () => {
    const p = { a: { pin: 'x', rot: 0 }, b: { box: 1, due: 0, seen: true } };
    T.eq(s.buildReviewRound(['a', 'b'], p, 100, 2, LG.rng.seeded(1)), ['b', 'a']);
  });
  T.test('revengeIds', () => {
    T.eq(s.revengeIds(['a', 'b'], { a: { revenge: true }, b: { revenge: false } }), ['a']);
  });
})();
