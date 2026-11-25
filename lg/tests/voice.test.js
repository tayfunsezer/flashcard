(function () {
  const V = LG.voice;
  const v = (name, lang, local = true) => ({ name, lang, localService: local });
  const prem = v('Ewa (Premium)', 'pl-PL');
  const enh = v('Ewa (Enhanced)', 'pl-PL');
  const plain = v('Zosia', 'pl_PL');
  const online = v('Google polski', 'pl-PL', false);
  const en = v('Samantha', 'en-US');

  T.test('rank orders Premium > Enhanced > plain local > online', () => {
    T.eq([V.rank(prem), V.rank(enh), V.rank(plain), V.rank(online)], [3, 2, 1, 0]);
  });
  T.test('forLang matches by primary subtag, best first', () => {
    const all = [online, plain, en, enh, prem, v('Odd', 'plx-XX')];
    T.eq(V.forLang(all, 'pl').map((x) => x.name), ['Ewa (Premium)', 'Ewa (Enhanced)', 'Zosia', 'Google polski']);
    T.eq(V.forLang(all, 'PL').length, 4);
    T.eq(V.forLang(all, 'en').map((x) => x.name), ['Samantha']);
    T.eq(V.forLang([], 'pl'), []);
  });
  T.test('forLang sorts equal ranks by name', () => {
    const kr = v('Krzysztof (Enhanced)', 'pl-PL');
    T.eq(V.forLang([plain, kr, enh], 'pl').map((x) => x.name), ['Ewa (Enhanced)', 'Krzysztof (Enhanced)', 'Zosia']);
  });
  T.test('pick prefers the saved voice, falls back to the best, null when none', () => {
    const all = [online, plain, prem];
    T.eq(V.pick(all, 'pl', 'Zosia').name, 'Zosia');
    T.eq(V.pick(all, 'pl', 'Gone').name, 'Ewa (Premium)');
    T.eq(V.pick(all, 'pl', '').name, 'Ewa (Premium)');
    T.eq(V.pick(all, 'pl').name, 'Ewa (Premium)');
    T.eq(V.pick([en], 'pl', 'Samantha'), null);
    T.eq(V.pick([], 'pl'), null);
  });
  T.test('label marks online voices', () => {
    T.eq(V.label(online), 'Google polski (online)');
    T.eq(V.label(plain), 'Zosia');
  });
  T.test('sampleText: first sentence in the file, else the first item, else the language name', () => {
    const items = [{ id: 'a', target: 'chleb' }, { id: 'b', target: 'Lubię jeść świeży chleb' }, { id: 'c', target: 'Dzień dobry wszystkim tutaj' }];
    const kinds = new Map([['a', 'term'], ['b', 'sentence'], ['c', 'sentence']]);
    T.eq(V.sampleText(items, kinds, 'Polish'), 'Lubię jeść świeży chleb');
    T.eq(V.sampleText([items[0]], new Map([['a', 'term']]), 'Polish'), 'chleb');
    T.eq(V.sampleText([], new Map(), 'Polish'), 'Polish');
  });
})();
