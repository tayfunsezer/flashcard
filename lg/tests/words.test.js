(function () {
  const w = LG.words;
  const items = (targets) => targets.map((t, i) => ({ id: 'i' + i, source: 's' + i, target: t, date: null, categories: ['C'] }));
  T.test('kindOf splits at 4 tokens', () => {
    T.eq(w.kindOf('merhaba', 'tr'), 'term');
    T.eq(w.kindOf('dondurma külahı', 'tr'), 'term');
    T.eq(w.kindOf('Bugün hava çok güzel', 'tr'), 'sentence');
  });
  T.test('clozeCandidates prefers rare, long-enough words', () => {
    const its = items(['ve bir kedi geldi', 've bir köpek geldi', 've bir kuş uçtu']);
    const rar = w.buildRarity(its, 'tr');
    T.eq(rar.get('geldi'), 2);
    T.eq(w.clozeCandidates('ve bir kedi geldi', rar, 'tr').map(c => c.text), ['kedi', 'geldi']);
  });
  T.test('clozeCandidates falls back to longest token', () => {
    const rar = w.buildRarity(items(['o bu şu da']), 'tr');
    T.eq(w.clozeCandidates('o bu şu da', rar, 'tr'), [{ text: 'bu', index: 2 }]);
  });
  T.test('pickBlank: pin, rotation, stale pin', () => {
    const its = items(['ve bir kedi geldi', 've bir köpek geldi']);
    const rar = w.buildRarity(its, 'tr');
    T.eq(w.pickBlank(its[0], { pin: 'geldi', rot: 0 }, rar, 'tr').text, 'geldi');
    T.eq(w.pickBlank(its[0], { pin: null, rot: 1 }, rar, 'tr').text, 'geldi');
    T.eq(w.pickBlank(its[0], { pin: null, rot: 2 }, rar, 'tr').text, 'kedi');
    T.eq(w.pickBlank(its[0], { pin: 'yok', rot: 0 }, rar, 'tr').text, 'kedi');
    T.eq(w.pickBlank(its[0], undefined, rar, 'tr').text, 'kedi');
    T.eq(w.pickBlank(its[0], { rot: 1 }, rar, 'tr').text, 'geldi');
  });
  T.test('pickBlank returns a single occurrence index', () => {
    const its = items(['kedi kedi kedi geldi']);
    const b = w.pickBlank(its[0], { pin: 'kedi', rot: 0 }, w.buildRarity(its, 'tr'), 'tr');
    T.eq(b, { text: 'kedi', index: 0 });
  });
  T.test('hintText ladder', () => {
    T.eq(w.hintText('kedi', 0), '');
    T.eq(w.hintText('kedi', 1), 'k…');
    T.eq(w.hintText('kedi', 2), 'k _ _ _');
    T.eq(w.hintText('kedi', 3), 'k _ d _');
  });
  T.test('specialLetters', () => {
    T.eq(w.specialLetters(items(['çok güzel', 'ışık ağaç']), 'tr').slice().sort(), ['ç', 'ğ', 'ı', 'ş', 'ü'].sort());
  });
  T.test('filterItems / groupOptions / itemsInCategory with multiple categories', () => {
    const its = [{ id: 'a', categories: ['A', 'B'], date: null }, { id: 'b', categories: ['B'], date: null }];
    T.eq(w.filterItems(its, { categories: ['A'] }).map(i => i.id), ['a']);
    T.eq(w.filterItems(its, { categories: ['B'] }).map(i => i.id), ['a', 'b']);
    T.eq(w.groupOptions(its).categories, [{ name: 'A', count: 1 }, { name: 'B', count: 2 }]);
    T.eq(w.itemsInCategory(its, 'B').map(i => i.id), ['a', 'b']);
  });
  T.test('filterItems and groupOptions', () => {
    const its = [
      { id: 'a', target: 'x', date: '2025-12-01', categories: ['A'] },
      { id: 'b', target: 'x', date: '2025-12-13', categories: ['B'] },
      { id: 'c', target: 'x', date: null, categories: ['A'] }];
    T.eq(w.filterItems(its, {}).length, 3);
    T.eq(w.filterItems(its, { dateFrom: '2025-12-01', dateTo: '2025-12-01' }).map(i => i.id), ['a']);
    T.eq(w.filterItems(its, { categories: ['A'] }).map(i => i.id), ['a', 'c']);
    T.eq(w.groupOptions(its), {
      categories: [{ name: 'A', count: 2 }, { name: 'B', count: 1 }],
      dates: [{ date: '2025-12-13', count: 1 }, { date: '2025-12-01', count: 1 }] });
  });
  T.test('searchCategories: empty query by count, prefix before contains, accent-insensitive, limit', () => {
    const o = [{ name: 'Zwierzęta', count: 3 }, { name: 'Żywność', count: 9 }, { name: 'Praca', count: 5 }, { name: 'Współpraca', count: 1 }];
    T.eq(LG.words.searchCategories(o, '', 'pl').map(c => c.name), ['Żywność', 'Praca', 'Zwierzęta', 'Współpraca']);
    T.eq(LG.words.searchCategories(o, 'praca', 'pl').map(c => c.name), ['Praca', 'Współpraca']);
    T.eq(LG.words.searchCategories(o, 'zyw', 'pl').map(c => c.name), ['Żywność']);
    T.eq(LG.words.searchCategories(o, '', 'pl', 2).length, 2);
  });
})();
