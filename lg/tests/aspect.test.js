(function () {
  const A = LG.aspect;
  const pair = { id: 'p1', source: 'to fasten a belt', target: 'zapinać (impf.) & zapiąć (pf.) pas' };

  T.test('parse reads the clean pattern', () => {
    T.eq(A.parse('zapinać (impf.) & zapiąć (pf.) pas'), { impf: 'zapinać', pf: 'zapiąć', extras: 'pas' });
    T.eq(A.parse('robić (impf.) & zrobić (pf.)'), { impf: 'robić', pf: 'zrobić', extras: '' });
  });
  T.test('parse accepts either order and any label case', () => {
    T.eq(A.parse('zrobić (pf.) & robić (impf.)'), { impf: 'robić', pf: 'zrobić', extras: '' });
    T.eq(A.parse('robić (IMPF.) & zrobić (Pf.)'), { impf: 'robić', pf: 'zrobić', extras: '' });
  });
  T.test('parse keeps multi-word verbs and several extras', () => {
    T.eq(A.parse('bać się (impf.) & zlękną się (pf.) kogoś, czegoś'), { impf: 'bać się', pf: 'zlękną się', extras: 'kogoś, czegoś' });
  });
  T.test('parse normalises whitespace', () => {
    const clean = A.parse('zapinać (impf.) & zapiąć (pf.) pas');
    T.eq(A.parse('  zapinać  (impf.) &  zapiąć (pf.)   pas '), clean);
  });
  T.test('parse returns null for non-pairs', () => {
    for (const s of ['Cenić sobie coś (impf.)', 'Uczestniczyć (impf.)', 'cieć & cieknąć', 'odmuchać & zdmuchnąć świeczki',
      'a (impf.) & b (impf.)', 'a (pf.) & b (pf.)', 'a (ipf.) & b (pf.)', '', 'Zapnij pas, proszę']) {
      T.eq(A.parse(s), null);
    }
  });
  T.test('pairIds picks only pair items, in item order', () => {
    const items = [{ id: 'a', target: 'x' }, pair, { id: 'z', target: 'robić (impf.) & zrobić (pf.)' }];
    T.eq(A.pairIds(items), ['p1', 'z']);
  });
  T.test('directions: fixed modes map every id one way', () => {
    const m = A.directions(['a', 'b', 'c'], 'pf-impf', LG.rng.seeded(1));
    T.eq([...m.values()], ['pf-impf', 'pf-impf', 'pf-impf']);
    T.eq([...A.directions(['a', 'b'], 'impf-pf', LG.rng.seeded(1)).values()], ['impf-pf', 'impf-pf']);
  });
  T.test('directions random is balanced and deterministic', () => {
    for (const n of [6, 7]) {
      const ids = Array.from({ length: n }, (_, i) => 'i' + i);
      const vals = [...A.directions(ids, 'random', LG.rng.seeded(1)).values()];
      const a = vals.filter((v) => v === 'impf-pf').length;
      T.eq(Math.abs(a - (n - a)), n % 2);
      T.eq(vals, [...A.directions(ids, 'random', LG.rng.seeded(1)).values()]);
    }
    T.eq(A.directions(['x'], 'random', LG.rng.seeded(1)).size, 1);
    T.eq(A.directions([], 'random', LG.rng.seeded(1)).size, 0);
  });
  T.test('card shows the label except in random', () => {
    const c = A.card(pair, 'impf-pf', 'impf-pf');
    T.eq([c.shown, c.shownAspect, c.answer, c.answerAspect, c.english, c.extras], ['zapinać', 'impf.', 'zapiąć', 'pf.', 'to fasten a belt', 'pas']);
    T.eq(A.card(pair, 'impf-pf', 'random').shownAspect, null);
    const r = A.card(pair, 'pf-impf', 'pf-impf');
    T.eq([r.shown, r.shownAspect, r.answer, r.answerAspect], ['zapiąć', 'pf.', 'zapinać', 'impf.']);
    T.eq(A.card({ id: 'n', source: 's', target: 'cieć & cieknąć' }, 'impf-pf', 'random'), null);
  });
  T.test('grade: right, accent slip, wrong, shown verb, extras', () => {
    const c = A.card(pair, 'impf-pf', 'impf-pf');
    T.eq(A.grade('zapiąć', c, 'pl'), 'correct');
    T.eq(A.grade('Zapiąć', c, 'pl'), 'correct');
    T.eq(A.grade('zapiac', c, 'pl'), 'almost');
    T.eq(A.grade('zapinać', c, 'pl'), 'wrong');
    T.eq(A.grade('zapiąć pas', c, 'pl'), 'correct');
    T.eq(A.grade('', c, 'pl'), 'wrong');
    const m = A.card({ id: 'm', source: 'to fear', target: 'bać się (impf.) & zlękną się (pf.)' }, 'pf-impf', 'pf-impf');
    T.eq(A.grade('bac sie', m, 'pl'), 'almost');
  });
  T.test('reveal shows the whole pair with extras', () => {
    T.eq(A.reveal(A.card(pair, 'impf-pf', 'random')), 'zapinać (impf.) & zapiąć (pf.) pas');
    T.eq(A.reveal(A.card({ id: 'z', source: 's', target: 'robić (impf.) & zrobić (pf.)' }, 'impf-pf', 'random')), 'robić (impf.) & zrobić (pf.)');
  });
  T.test('guess mode: card keeps the true aspect, hides the label, directions like random', () => {
    const c = A.card(pair, 'impf-pf', 'random-guess');
    T.eq([c.shownAspect, c.shownKind], [null, 'impf.']);
    T.eq(A.card(pair, 'pf-impf', 'impf-pf').shownKind, 'pf.');
    const ids = ['a', 'b', 'c', 'd'];
    const vals = [...A.directions(ids, 'random-guess', LG.rng.seeded(1)).values()];
    T.eq(vals.filter((v) => v === 'impf-pf').length, 2);
  });
  T.test('gradeGuess: a wrong aspect with the right partner is almost', () => {
    const c = A.card(pair, 'impf-pf', 'random-guess'); // shown zapinać (impf.), answer zapiąć
    T.eq(A.gradeGuess('zapiąć', 'impf.', c, 'pl'), { result: 'correct', aspectOk: true });
    T.eq(A.gradeGuess('zapiąć', 'pf.', c, 'pl'), { result: 'almost', aspectOk: false });
    T.eq(A.gradeGuess('zapiac', 'impf.', c, 'pl'), { result: 'almost', aspectOk: true });
    T.eq(A.gradeGuess('xyz', 'impf.', c, 'pl'), { result: 'wrong', aspectOk: true });
    T.eq(A.gradeGuess('xyz', 'pf.', c, 'pl'), { result: 'wrong', aspectOk: false });
  });
  T.test('blankLength: no length hint in the random modes', () => {
    const short = A.card({ id: 'a', source: 's', target: 'robić (impf.) & zrobić (pf.)' }, 'pf-impf', 'random');
    const long = A.card({ id: 'b', source: 's', target: 'zapinać (impf.) & zapiąć (pf.)' }, 'pf-impf', 'random');
    T.ok(short.answer.length !== long.answer.length);
    T.eq(A.blankLength(short, 'random'), A.blankLength(long, 'random'));
    T.eq(A.blankLength(short, 'random-guess'), A.blankLength(long, 'random-guess'));
    T.eq(A.blankLength(short, 'pf-impf'), 5);
    T.eq(A.blankLength(long, 'pf-impf'), 7);
  });
})();
