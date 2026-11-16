(function () {
  T.test('reparse table and json', () => {
    const t = LG.reload.reparse({ rows: [['dom', 'house']], encoding: 'utf-8' }, 'a.csv', 1);
    T.eq([t.ok, t.dataset.items[0].target, t.dataset.fileName], [true, 'dom', 'a.csv']);
    const j = LG.reload.reparse({ json: '[{"question":"cat","options":["kot"],"correctIndex":0}]', encoding: 'utf-8' }, 'q.json', 2);
    T.eq([j.ok, j.dataset.items[0].target], [true, 'kot']);
  });
  T.test('reparse keeps learnColumn on the dataset', () => {
    const r = LG.reload.reparse({ rows: [['bread', 'chleb']], encoding: 'utf-8' }, 'a.csv', 2);
    T.eq([r.dataset.learnColumn, r.dataset.items[0].target], [2, 'chleb']);
  });
  T.test('reparse returns ok:false and no dataset for an empty table / invalid JSON', () => {
    const e = LG.reload.reparse({ rows: [], encoding: 'utf-8' }, 'a.csv', 1);
    T.eq([e.ok, e.dataset, e.error], [false, undefined, 'No rows with both a Source and a Target were found.']);
    const bad = LG.reload.reparse({ json: '{nope', encoding: 'utf-8' }, 'q.json', 1);
    T.eq([bad.ok, bad.error], [false, 'This file is not valid JSON.']);
  });
  T.test('diff and bannerText', () => {
    const d = LG.reload.diff([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }, { id: 'd' }]);
    T.eq(d, { total: 3, added: 2, removed: 1 });
    T.eq(LG.reload.bannerText('pl.xlsx', d), 'Refreshed pl.xlsx: 3 items (+2 new, −1 gone)');
  });
})();
