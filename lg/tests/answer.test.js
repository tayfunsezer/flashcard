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
})();
