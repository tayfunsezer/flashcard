(function () {
  const c = LG.answer.checkAnswer;
  T.test('correct ignores case, spaces, edge punctuation', () => {
    T.eq(c('  Kedi. ', 'kedi', 'tr'), 'correct');
    T.eq(c('istanbul', 'İstanbul', 'tr'), 'correct');
    T.eq(c('İSTANBUL', 'İstanbul', 'tr'), 'correct');
    T.eq(c('ığdır', 'Iğdır', 'tr'), 'correct');
  });
  T.test('spec examples', () => {
    T.eq(c('kiz', 'kız', 'tr'), 'almost');
    T.eq(c('cok', 'çok', 'tr'), 'almost');
    T.eq(c('lodz', 'łódź', 'pl'), 'almost');
    T.eq(c('zolw', 'żółw', 'pl'), 'almost');
    T.eq(c('igdir', 'Iğdır', 'tr'), 'almost');
    T.eq(c('ISTANBUL', 'İstanbul', 'tr'), 'almost');
  });
  T.test('wrong and empty', () => {
    T.eq(c('köpek', 'kedi', 'tr'), 'wrong');
    T.eq(c('', 'kedi', 'tr'), 'wrong');
  });
  T.test('multi-word answers', () => {
    T.eq(c('boje sie', 'boję się', 'pl'), 'almost');
    T.eq(c('boję  się', 'boję się', 'pl'), 'correct');
  });
  T.test('checkWhole', () => {
    const A = LG.answer;
    T.eq(A.checkWhole('orać zaorać pole', 'orać & zaorać pole', 'pl'), 'correct');
    T.eq(A.checkWhole('  Orać & zaorać   pole. ', 'orać & zaorać pole', 'pl'), 'correct');
    T.eq(A.checkWhole('orac zaorac pole', 'orać & zaorać pole', 'pl'), 'almost');
    T.eq(A.checkWhole('zaorać pole', 'orać & zaorać pole', 'pl'), 'wrong');
    T.eq(A.checkWhole('orać zaorać pole pole', 'orać & zaorać pole', 'pl'), 'wrong');
    T.eq(A.checkWhole('', 'boję się', 'pl'), 'wrong');
    T.eq(A.checkWhole('İstanbul', 'istanbul', 'tr'), 'correct');
  });
  T.test('checkWhole: words in parentheses are optional', () => {
    const A = LG.answer;
    T.eq(A.checkWhole('bać się', 'bać się (czegoś)', 'pl'), 'correct');
    T.eq(A.checkWhole('bać się czegoś', 'bać się (czegoś)', 'pl'), 'correct');
    T.eq(A.checkWhole('bać się (czegoś)', 'bać się (czegoś)', 'pl'), 'correct');
    T.eq(A.checkWhole('bac sie', 'bać się (czegoś)', 'pl'), 'almost');
    T.eq(A.checkWhole('robić dobrze', '(komuś) robić, dobrze', 'pl'), 'correct');
    T.eq(A.checkWhole('bać', 'bać się (czegoś)', 'pl'), 'wrong');
    T.eq(A.checkWhole('czegoś', '(czegoś)', 'pl'), 'correct');
  });
  T.test('checkWhole ignores commas and ampersands in the input too', () => {
    const A = LG.answer;
    T.eq(A.checkWhole('orać, zaorać', 'orać zaorać', 'pl'), 'correct');
    T.eq(A.checkWhole('orać & zaorać', 'orać zaorać', 'pl'), 'correct');
  });
})();

(function () {
  const d = LG.answer.diffWords;
  const st = (r) => r.typed.map((t) => t.status);
  T.test('diffWords: left-out word is missing, typed words ok', () => {
    const r = d('boję się', 'boję się czegoś', 'pl');
    T.eq(st(r), ['ok', 'ok']);
    T.eq(r.missing, ['czegoś']);
  });
  T.test('diffWords: accent-only slips are almost', () => {
    const r = d('bac sie czegos', 'bać się czegoś', 'pl');
    T.eq(st(r), ['almost', 'almost', 'almost']);
    T.eq(r.missing, []);
  });
  T.test('diffWords: one wrong word does not mark the rest', () => {
    const r = d('ala ma psa', 'ala ma kota', 'pl');
    T.eq(st(r), ['ok', 'ok', 'wrong']);
    T.eq(r.missing, []);
    T.eq(r.typed[2].text, 'psa');
  });
  T.test('diffWords: an extra typed word is the only wrong one', () => {
    T.eq(st(d('ala ma bardzo kota', 'ala ma kota', 'pl')), ['ok', 'ok', 'wrong', 'ok']);
  });
  T.test('diffWords: optional bracketed words', () => {
    const a = d('bać się', 'bać się (czegoś)', 'pl');
    T.eq(st(a), ['ok', 'ok']);
    T.eq(a.missing, []);
    T.eq(st(d('bać się czegoś', 'bać się (czegoś)', 'pl')), ['ok', 'ok', 'ok']);
  });
  T.test('diffWords: empty input', () => {
    const r = d('', 'kot', 'pl');
    T.eq(r.typed, []);
    T.eq(r.missing, ['kot']);
  });
})();
