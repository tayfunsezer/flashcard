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
  T.test('defer sends a word to the end without counting it', () => {
    const r = R.defer(R.create(['a', 'b', 'c']), 'a');
    T.eq(r.queue, ['b', 'c', 'a']);
    T.eq(r.first, {});
    T.eq(R.defer(r, 'zzz').queue, ['b', 'c', 'a']);
  });
  T.test('canDefer needs another word in the queue', () => {
    T.ok(!R.canDefer(R.create(['a'])));
    T.ok(R.canDefer(R.create(['a', 'b'])));
  });
  T.test('reanswer: wrong then right takes the word out of the queue and out of missed', () => {
    let r = R.record(R.create(['a', 'b']), 'a', 'wrong');
    r = R.reanswer(r, 'a', 'correct');
    T.eq(r.first.a, 'correct');
    T.ok(!r.queue.includes('a'));
    T.eq(R.missed(r), []);
  });
  T.test('reanswer: right then wrong queues the word once at the end', () => {
    let r = R.record(R.create(['a', 'b']), 'a', 'correct');
    r = R.reanswer(r, 'a', 'wrong');
    T.eq(r.queue, ['b', 'a']);
    T.eq(r.repeats.a, 1);
    r = R.reanswer(r, 'a', 'wrong');
    T.eq(r.queue, ['b', 'a']);
    T.eq(r.repeats.a, 1);
    T.eq(R.missed(r), ['a']);
  });
  T.test('reanswer: no more repeats once MAX_REPEATS is used', () => {
    let r = R.create(['a']);
    for (let i = 0; i < 4; i++) r = R.record(r, 'a', 'wrong');
    r = R.reanswer(r, 'a', 'wrong');
    T.ok(!r.queue.includes('a'));
    T.eq(r.repeats.a, 3);
  });
})();
