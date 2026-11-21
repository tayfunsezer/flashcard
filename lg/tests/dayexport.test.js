(function () {
  const rows = [
    ['dom', 'house', '26-10-2026'], ['kot', 'cat', '26-10-2026'], ['pies', 'dog', '05-10-2026'],
    ['ptak', 'bird', ''], ['ryba', 'fish', '01-09-2026'], ['koń', 'horse', '01-09-2026'],
  ];
  const items = () => LG.importer.rowsToDataset(rows, { learnColumn: 1 }).items;

  T.test('datesIn counts per date, newest first, skips undated', () => {
    T.eq(LG.dayexport.datesIn(items()), [
      { date: '2026-10-26', count: 2 }, { date: '2026-10-05', count: 1 }, { date: '2026-09-01', count: 2 }]);
    T.eq(LG.dayexport.datesIn([]), []);
  });
  T.test('relPath builds month folder and unpadded day', () => {
    T.eq(LG.dayexport.relPath('2026-10-26'), ['october-2026', 'marked-words', 'marked_words-26.json']);
    T.eq(LG.dayexport.relPath('2026-09-05'), ['september-2026', 'marked-words', 'marked_words-5.json']);
    const names = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    names.forEach((n, i) => T.eq(LG.dayexport.relPath('2026-' + String(i + 1).padStart(2, '0') + '-01')[0], n + '-2026'));
  });
  T.test('dayQuiz returns only that day, question = source, answer = target', () => {
    const all = items();
    const quiz = LG.dayexport.dayQuiz(all, '2026-10-26', 'pl', LG.rng.seeded(2));
    T.eq(quiz.map((q) => q.question), ['house', 'cat']);
    T.eq(quiz.map((q) => q.options[q.correctIndex]), ['dom', 'kot']);
    for (const q of quiz) T.eq(q.options.length, 4);
    T.eq(LG.dayexport.dayQuiz(all, '2030-01-01', 'pl', LG.rng.seeded(2)), []);
  });
  T.test('dayQuiz with one word and with own options', () => {
    const one = [{ id: 'a', source: 'cat', target: 'kot', date: '2026-10-26', categories: ['x'] }];
    T.eq(LG.dayexport.dayQuiz(one, '2026-10-26', 'pl', LG.rng.seeded(1)), [{ question: 'cat', options: ['kot'], correctIndex: 0 }]);
    const own = [{ id: 'b', source: 'q', target: 'A', date: '2026-10-26', categories: ['x'], options: ['B', 'C'] }];
    const q = LG.dayexport.dayQuiz(own, '2026-10-26', 'en', LG.rng.seeded(1))[0];
    T.eq([q.options.slice().sort(), q.options[q.correctIndex]], [['A', 'B', 'C'], 'A']);
  });
  T.test('dayQuiz round-trips through jsonToDataset with the same ids', () => {
    const all = items();
    const quiz = LG.dayexport.dayQuiz(all, '2026-10-26', 'pl', LG.rng.seeded(3));
    const back = LG.importer.jsonToDataset(JSON.stringify(quiz), 'marked_words-26.json').items.map((it) => it.id);
    T.eq(back, [all[0].id, all[1].id]);
  });
  // In-memory stand-in for a FileSystemDirectoryHandle.
  function fakeDir(failWith) {
    const dir = { dirs: {}, files: {} };
    const wrap = (d) => ({
      async getDirectoryHandle(name, opts) {
        if (failWith) throw { name: failWith };
        if (!d.dirs[name]) {
          if (!(opts && opts.create)) throw { name: 'NotFoundError' };
          d.dirs[name] = { dirs: {}, files: {} };
        }
        return wrap(d.dirs[name]);
      },
      async getFileHandle(name, opts) {
        if (!(name in d.files)) {
          if (!(opts && opts.create)) throw { name: 'NotFoundError' };
          d.files[name] = '';
        }
        return { async createWritable() { return { async write(t) { d.files[name] = t; }, async close() {} }; } };
      },
    });
    return { dir, handle: wrap(dir) };
  }
  const PATH = ['october-2026', 'marked-words', 'marked_words-26.json'];
  const fileOf = (dir) => dir.dirs['october-2026'] && dir.dirs['october-2026'].dirs['marked-words'].files['marked_words-26.json'];

  T.test('writeToRepo writes into new month folders', async () => {
    const f = fakeDir();
    T.eq(await LG.dayexport.writeToRepo(f.handle, PATH, 'NEW', false), 'written');
    T.eq(fileOf(f.dir), 'NEW');
  });
  T.test('writeToRepo reports exists and writes nothing', async () => {
    const f = fakeDir();
    await LG.dayexport.writeToRepo(f.handle, PATH, 'OLD', false);
    T.eq(await LG.dayexport.writeToRepo(f.handle, PATH, 'NEW', false), 'exists');
    T.eq(fileOf(f.dir), 'OLD');
  });
  T.test('writeToRepo overwrite replaces the existing file', async () => {
    const f = fakeDir();
    await LG.dayexport.writeToRepo(f.handle, PATH, 'OLD', false);
    T.eq(await LG.dayexport.writeToRepo(f.handle, PATH, 'NEW', true), 'written');
    T.eq(fileOf(f.dir), 'NEW');
  });
  T.test('writeToRepo leaves other files and folders alone', async () => {
    const f = fakeDir();
    await LG.dayexport.writeToRepo(f.handle, PATH, 'A', false);
    await LG.dayexport.writeToRepo(f.handle, ['october-2026', 'marked-words', 'marked_words-27.json'], 'B', false);
    T.eq(Object.keys(f.dir.dirs['october-2026'].dirs['marked-words'].files).sort(), ['marked_words-26.json', 'marked_words-27.json']);
    T.eq(fileOf(f.dir), 'A');
  });
  T.test('writeToRepo propagates other errors', async () => {
    const f = fakeDir('NotAllowedError');
    let err = null;
    try { await LG.dayexport.writeToRepo(f.handle, PATH, 'X', false); } catch (e) { err = e; }
    T.eq(err && err.name, 'NotAllowedError');
  });
})();
