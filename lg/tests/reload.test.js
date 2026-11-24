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
  const it = (id, source, target) => ({ id, source, target });
  T.test('carryOver pairs an edited target and an edited source with their corrected rows', () => {
    const oldI = [it('o1', 'house', 'dmo'), it('o2', 'hose', 'kot'), it('k', 'cat', 'kot2')];
    const newI = [it('n1', 'house', 'dom'), it('n2', 'house2', 'kot'), it('k', 'cat', 'kot2')];
    T.eq(LG.reload.carryOver(oldI, newI), [{ from: 'o1', to: 'n1', targetChanged: true }, { from: 'o2', to: 'n2', targetChanged: false }]);
  });
  T.test('carryOver ignores rows where both sides changed and unchanged rows', () => {
    T.eq(LG.reload.carryOver([it('o', 'a', 'b'), it('k', 'x', 'y')], [it('n', 'c', 'd'), it('k', 'x', 'y')]), []);
  });
  T.test('carryOver carries nothing when the match is ambiguous', () => {
    const oldI = [it('o1', 'house', 'dmo'), it('o2', 'house', 'dmoo')];
    T.eq(LG.reload.carryOver(oldI, [it('n1', 'house', 'dom')]), []);
    T.eq(LG.reload.carryOver([it('o1', 'house', 'dmo')], [it('n1', 'house', 'dom'), it('n2', 'house', 'dom2')]), []);
    // one new row that matches two gone rows (one by source, one by target)
    T.eq(LG.reload.carryOver([it('o1', 'house', 'x'), it('o2', 'y', 'dom')], [it('n1', 'house', 'dom')]), []);
  });
  T.test('carryOver compares normalised text', () => {
    T.eq(LG.reload.carryOver([it('o1', 'house ', 'dmo')], [it('n1', 'house', 'dom')]).length, 1);
  });
  T.test('carryState moves progress, clears the pin only when the target changed, keeps an existing destination', () => {
    const S = LG.state;
    const st = S.defaultState();
    st.progress = { o1: { box: 3, due: 5, seen: true, star: true, pin: ['dmo'], rot: 1 }, o2: { box: 2, pin: ['x'] }, n3: { box: 5 }, o3: { box: 1 } };
    const out = LG.reload.carryState(st, [
      { from: 'o1', to: 'n1', targetChanged: true }, { from: 'o2', to: 'n2', targetChanged: false }, { from: 'o3', to: 'n3', targetChanged: false }]);
    T.eq(out.progress.n1, { box: 3, due: 5, seen: true, star: true, pin: null, rot: 1 });
    T.eq(out.progress.n2.pin, ['x']);
    T.eq(out.progress.n3, { box: 5 });
    T.ok(!('o1' in out.progress) && !('o2' in out.progress));
  });
  T.test('carryState remaps the study set', () => {
    const st = LG.state.defaultState();
    st.studySet = { by: 'date', value: 'x', game: 'cloze', queue: ['o1', 'b'], done: ['o2'], total: 3 };
    const out = LG.reload.carryState(st, [{ from: 'o1', to: 'n1', targetChanged: false }, { from: 'o2', to: 'n2', targetChanged: false }]);
    T.eq([out.studySet.queue, out.studySet.done], [['n1', 'b'], ['n2']]);
  });
  T.test('bannerText counts edited rows apart from new and gone', () => {
    const d = { total: 5, added: 2, removed: 1 };
    T.eq(LG.reload.bannerText('a.csv', d), 'Refreshed a.csv: 5 items (+2 new, \u22121 gone)');
    T.eq(LG.reload.bannerText('a.csv', d, 1), 'Refreshed a.csv: 5 items (+1 new, \u22120 gone, 1 edited)');
  });
})();
