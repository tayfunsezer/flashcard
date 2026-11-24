(function () {
  const Tr = LG.trail;
  const build = (...ids) => ids.reduce((t, id) => Tr.push(t, id), Tr.create());
  T.test('trail: empty has nowhere to go', () => {
    const t = Tr.create();
    T.eq(Tr.current(t), null);
    T.ok(!Tr.canBack(t) && !Tr.canForward(t));
    T.eq([Tr.back(t), Tr.forward(t)], [null, null]);
  });
  T.test('trail: back and forward walk the history', () => {
    const t = build('a', 'b', 'c');
    T.eq(Tr.current(t), 'c');
    T.ok(!Tr.canForward(t));
    const b = Tr.back(t);
    T.eq(Tr.current(b), 'b');
    const a = Tr.back(b);
    T.eq(Tr.current(a), 'a');
    T.eq(Tr.back(a), null);
    T.ok(!Tr.canBack(a));
    T.eq(Tr.current(Tr.forward(a)), 'b');
    T.ok(Tr.canForward(a));
  });
  T.test('trail: functions do not mutate their input', () => {
    const t = build('a', 'b');
    Tr.back(t);
    Tr.push(t, 'c');
    T.eq(t, { ids: ['a', 'b'], pos: 1 });
  });
})();
