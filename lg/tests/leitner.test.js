(function () {
  const L = LG.leitner, D = LG.schedule.DAY_MS;
  const now = new Date(2026, 9, 26, 10, 0, 0).getTime();
  const p = {
    a: { box: 0, due: now - 1, seen: true },
    b: { box: 1, due: now + 2 * 3600e3, seen: true },   // later today -> due today
    c: { box: 1, due: now + 2 * D, seen: true },
    d: { box: 5, due: now - D, seen: true },
    e: { pin: 'x', rot: 0 },                           // partial entry -> new
  };
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  T.test('boxOf', () => {
    T.eq([L.boxOf(p.a), L.boxOf(p.c), L.boxOf(p.e), L.boxOf(undefined)], [0, 1, 'new', 'new']);
  });
  T.test('board counts and due-today', () => {
    const b = L.board(ids, p, now);
    T.eq(b.new.count, 2);
    T.eq(b.boxes.map(x => [x.box, x.count, x.due]), [[0, 1, 1], [1, 2, 1], [2, 0, 0], [3, 0, 0], [4, 0, 0], [5, 1, 1]]);
  });
  T.test('dueIds: due today, lowest box first', () => {
    T.eq(L.dueIds(ids, p, now), ['a', 'b', 'd']);
  });
  T.test('idsInBox', () => {
    T.eq(L.idsInBox(ids, p, 1), ['b', 'c']);
    T.eq(L.idsInBox(ids, p, 'new'), ['e', 'f']);
  });
})();
