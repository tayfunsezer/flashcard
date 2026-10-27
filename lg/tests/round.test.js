(function () {
  const R = LG.round;
  T.test('missed word repeats at the end until right; only first answer recorded', () => {
    let r = R.create(['a', 'b', 'c']);
    r = R.record(r, 'a', 'wrong');
    T.eq(r.queue, ['b', 'c', 'a']);
    T.ok(!R.isFirst(r, 'a'));
    r = R.record(r, 'b', 'correct');
    r = R.record(r, 'c', 'almost');
    T.eq(R.current(r), 'a');
    r = R.record(r, 'a', 'correct');
    T.ok(R.isDone(r));
    T.eq(r.first, { a: 'wrong', b: 'correct', c: 'almost' });
    T.eq(R.missed(r), ['a']);
    T.eq(R.progress(r), { done: 3, total: 3 });
  });
  T.test('a word leaves after 3 repeats so the round ends', () => {
    let r = R.create(['a']);
    for (let i = 0; i < 4; i++) r = R.record(r, 'a', 'wrong');
    T.ok(R.isDone(r));
    T.eq(r.repeats.a, 3);
  });
  T.test('record does not mutate input', () => {
    const r0 = R.create(['a', 'b']);
    R.record(r0, 'a', 'wrong');
    T.eq(r0.queue, ['a', 'b']);
  });
  T.test('drop removes a word without an answer (Multiple Choice skip)', () => {
    const r = R.drop(R.create(['a', 'b']), 'a');
    T.eq(r.queue, ['b']);
    T.ok(R.isFirst(r, 'a'));
    T.eq(R.missed(r), []);
    T.eq(R.progress(r), { done: 1, total: 2 });
  });
})();
