(function () {
  const pick = LG.distractors.pickDistractors;
  const pool = [
    { text: 'kedi', categories: ['A'] }, { text: 'köpek', categories: ['A'] }, { text: 'kuş', categories: ['A'] },
    { text: 'balık', categories: ['A'] }, { text: 'Kedi', categories: ['B'] }, { text: 'masa', categories: ['B'] }];
  T.test('same category, excludes correct, unique', () => {
    const d = pick('kedi', pool, ['A'], 'tr', LG.rng.seeded(3));
    T.eq(d.length, 3);
    T.ok(d.every(x => ['köpek', 'kuş', 'balık'].includes(x)));
  });
  T.test('falls back to other categories', () => {
    const d = pick('masa', pool, ['B'], 'tr', LG.rng.seeded(3));
    T.eq(d.length, 3);
    T.ok(!d.some(x => x.toLowerCase() === 'masa'));
  });
  T.test('pickDistractors: shared category counts as same', () => {
    const p = [{ text: 'x1', categories: ['A', 'Z'] }, { text: 'x2', categories: ['Z'] },
      { text: 'x3', categories: ['B'] }, { text: 'x4', categories: ['Q'] }, { text: 'x5', categories: ['Q'] }];
    const d = LG.distractors.pickDistractors('ans', p, ['B', 'Z'], 'pl', LG.rng.seeded(1), 3);
    T.eq(d.slice().sort(), ['x1', 'x2', 'x3']);
  });
})();
