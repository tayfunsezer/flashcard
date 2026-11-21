(function () {
  T.test('markedQuiz round-trips through jsonToDataset with the same ids', () => {
    const items = LG.importer.rowsToDataset([['boję się', 'I am afraid'], ['dom', 'house'], ['kot', 'cat'], ['pies', 'dog'], ['orać & zaorać pole', 'plough the field']], { learnColumn: 1 }).items;
    const progress = { [items[0].id]: { star: true }, [items[4].id]: { star: true } };
    const quiz = LG.marked.markedQuiz(items, progress, 'pl', LG.rng.seeded(3));
    T.eq(quiz.length, 2);
    for (const q of quiz) T.ok(q.options.length === 4 && q.correctIndex >= 0 && q.correctIndex < 4);
    const back = LG.importer.jsonToDataset(JSON.stringify(quiz), 'marked-x.json').items.map((it) => it.id);
    T.eq(back, [items[0].id, items[4].id]);
  });
  T.test('markedQuiz with one item and own options', () => {
    const one = [{ id: 'a', source: 'cat', target: 'kot', date: null, categories: ['x'] }];
    T.eq(LG.marked.markedQuiz(one, { a: { star: true } }, 'pl', LG.rng.seeded(1)), [{ question: 'cat', options: ['kot'], correctIndex: 0 }]);
    const own = [{ id: 'b', source: 'q', target: 'A', date: null, categories: ['x'], options: ['B', 'C'] }];
    const q = LG.marked.markedQuiz(own, { b: { star: true } }, 'en', LG.rng.seeded(1))[0];
    T.eq([q.options.slice().sort(), q.options[q.correctIndex]], [['A', 'B', 'C'], 'A']);
  });
  T.test('markedItems returns the starred items in file order', () => {
    const items = LG.importer.rowsToDataset([['a', 'A'], ['b', 'B'], ['c', 'C']], { learnColumn: 1 }).items;
    const progress = { [items[2].id]: { star: true }, [items[0].id]: { star: true }, [items[1].id]: { star: false } };
    T.eq(LG.marked.markedItems(items, progress).map((it) => it.target), ['a', 'c']);
    T.eq(LG.marked.markedItems(items, {}), []);
  });
  T.test('exportFileName', () => {
    T.eq(LG.marked.exportFileName('polish.xlsx', '2026-11-16'), 'marked-polish-2026-11-16.json');
    T.eq(LG.marked.exportFileName('marked-polish-2026-11-10.json', '2026-11-16'), 'marked-polish-2026-11-16.json');
    T.eq(LG.marked.exportFileName('Sample data', '2026-11-16'), 'marked-sample-2026-11-16.json');
  });
})();
