(function () {
  const t = LG.text;
  T.test('normalizeCell trims, collapses, NFC', () => {
    T.eq(t.normalizeCell('  hello   \t world '), 'hello world');
    T.eq(t.normalizeCell(null), '');
    T.eq(t.normalizeCell(42), '42');
    T.eq(t.normalizeCell('café'), 'café');
  });
  T.test('lower respects Turkish', () => {
    T.eq(t.lower('İSTANBUL', 'tr'), 'istanbul');
    T.eq(t.lower('ISPARTA', 'tr'), 'ısparta');
  });
  T.test('fold handles non-decomposing letters', () => {
    T.eq(t.fold('kız', 'tr'), 'kiz');
    T.eq(t.fold('çok', 'tr'), 'cok');
    T.eq(t.fold('łódź', 'pl'), 'lodz');
    T.eq(t.fold('Żółw', 'pl'), 'zolw');
    T.eq(t.fold('Straße', 'de'), 'strasse');
  });
  T.test('stripEdges removes surrounding punctuation only', () => {
    T.eq(t.stripEdges(' "kedi." '), 'kedi');
    T.eq(t.stripEdges("don't!"), "don't");
  });
  T.test('tokenize keeps word-like segments with indexes', () => {
    T.eq(t.tokenize('Bugün, hava çok güzel!', 'tr'),
      [{ text: 'Bugün', index: 0 }, { text: 'hava', index: 7 }, { text: 'çok', index: 12 }, { text: 'güzel', index: 16 }]);
    T.ok(t.tokenize('我喜欢猫', 'zh').length >= 2);
  });
  T.test('charLength and isDenseScript', () => {
    T.eq(t.charLength('żółw'), 4);
    T.ok(t.isDenseScript('猫'));
    T.ok(!t.isDenseScript('kedi'));
  });
  T.test('matchCase follows the model capitalisation, locale-aware', () => {
    T.eq(t.matchCase('Kot', 'a', 'pl'), 'kot');
    T.eq(t.matchCase('kot', 'Ala', 'pl'), 'Kot');
    T.eq(t.matchCase('żółw', 'Ala', 'pl'), 'Żółw');
    T.eq(t.matchCase('ŻÓŁW', 'a', 'pl'), 'żółw');
    T.eq(t.matchCase('istanbul', 'A', 'tr'), 'İstanbul');
    T.eq(t.matchCase('Istanbul', 'a', 'tr'), 'ıstanbul');
    T.eq(t.matchCase('', 'A', 'pl'), '');
  });
})();
