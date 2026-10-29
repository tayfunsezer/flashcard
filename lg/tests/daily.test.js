(function () {
  const dl = LG.daily;
  const it = (id, target) => ({ id, source: 'en-' + id, target, date: null, categories: ['C'] });
  const items = [it('1', 'kedi'), it('2', 'ev'), it('3', 'dondurma külahı'), it('4', 'abc123'),
    it('5', 'Bugün çok güzel hava'), it('6', 'Kedi')];
  T.test('dailyPool rules', () => {
    const pool = dl.dailyPool(items, LG.words.buildRarity(items, 'tr'), 'tr');
    const words = pool.map(p => p.word.toLocaleLowerCase('tr'));
    T.ok(words.includes('kedi'));
    T.ok(!words.includes('ev'));
    T.eq(words.filter(w => w === 'kedi').length, 1);
    T.ok(words.some(w => ['bugün', 'güzel', 'hava'].includes(w)));
    T.eq(pool.find(p => p.word === 'kedi').clue, 'en-1');
  });
  T.test('dailyEntry deterministic', () => {
    const pool = [{ word: 'a' }, { word: 'b' }, { word: 'c' }];
    T.eq(dl.dailyEntry(pool, '2025-12-13'), dl.dailyEntry(pool, '2025-12-13'));
    T.eq(dl.dailyEntry([], '2025-12-13'), null);
  });
  T.test('scoreGuess', () => {
    T.eq(dl.scoreGuess('deki', 'kedi', 'tr'), ['yellow', 'green', 'yellow', 'green']);
    T.eq(dl.scoreGuess('kkkk', 'kase', 'tr'), ['green', 'grey', 'grey', 'grey']);
    T.eq(dl.scoreGuess('KEDİ', 'kedi', 'tr'), ['green', 'green', 'green', 'green']);
    T.eq(dl.scoreGuess('KEDI', 'kedi', 'tr')[3], 'grey');
    T.eq(dl.scoreGuess('cok', 'çok', 'tr')[0], 'grey');
  });
  T.test('keyboardLetters', () => {
    const k = dl.keyboardLetters([it('1', 'çok')], 'tr');
    T.eq(k.slice(0, 26).join(''), 'abcdefghijklmnopqrstuvwxyz');
    T.ok(k.includes('ç'));
  });
  T.test('dailyPool uses array pins only when single', () => {
    const its = [{ id: 'p', source: 's', target: 'Nie lubię ciemnych kotów', date: null, categories: ['A'] }];
    const rar = LG.words.buildRarity(its, 'pl');
    T.eq(LG.daily.dailyPool(its, rar, 'pl', { p: ['kotów'] }).map(e => e.word), ['kotów']);
    T.eq(LG.daily.dailyPool(its, rar, 'pl', { p: ['lubię', 'kotów'] }).map(e => e.word).includes('kotów'), false);
  });
})();
