(function () {
  const r = LG.rewards;
  T.test('promptXp', () => {
    T.eq(r.promptXp({ result: 'correct', hints: 0 }), 10);
    T.eq(r.promptXp({ result: 'correct', hints: 1 }), 7);
    T.eq(r.promptXp({ result: 'correct', hints: 3 }), 2);
    T.eq(r.promptXp({ result: 'almost', hints: 0 }), 5);
    T.eq(r.promptXp({ result: 'almost', hints: 2 }), 2);
    T.eq(r.promptXp({ result: 'wrong', hints: 0 }), 0);
  });
  T.test('comboMultiplier', () => {
    T.eq([4, 5, 9, 10].map(r.comboMultiplier), [1, 1.5, 1.5, 2]);
  });
  T.test('matchXp', () => {
    T.eq(r.matchXp({ pairs: 6, misses: 0, seconds: 20 }), 50);
    T.eq(r.matchXp({ pairs: 6, misses: 3, seconds: 20 }), 44);
    T.eq(r.matchXp({ pairs: 6, misses: 0, seconds: 90 }), 30);
  });
  T.test('levelInfo', () => {
    T.eq(r.levelInfo(0), { level: 1, floorXp: 0, nextXp: 50, progress: 0 });
    T.eq(r.levelInfo(49).level, 1);
    T.eq(r.levelInfo(50), { level: 2, floorXp: 50, nextXp: 200, progress: 0 });
    T.eq(r.levelInfo(200).level, 3);
  });
  T.test('updateStreak', () => {
    T.eq(r.updateStreak({ current: 0, best: 0, lastDay: null }, '2025-12-13'), { current: 1, best: 1, lastDay: '2025-12-13' });
    T.eq(r.updateStreak({ current: 3, best: 5, lastDay: '2025-12-13' }, '2025-12-13'), { current: 3, best: 5, lastDay: '2025-12-13' });
    T.eq(r.updateStreak({ current: 5, best: 5, lastDay: '2025-12-12' }, '2025-12-13'), { current: 6, best: 6, lastDay: '2025-12-13' });
    T.eq(r.updateStreak({ current: 6, best: 6, lastDay: '2025-12-10' }, '2025-12-13'), { current: 1, best: 6, lastDay: '2025-12-13' });
  });
  T.test('medals', () => {
    T.eq([0.29, 0.3, 0.6, 0.9].map(r.medalFor), ['none', 'bronze', 'silver', 'gold']);
    T.eq(r.categoryShare(['a', 'b'], { a: { box: 3 }, b: { box: 1 } }), 0.5);
    T.eq(r.categoryShare([], {}), 0);
  });
})();
