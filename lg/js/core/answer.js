(function (LG) {
  function prep(x, lang) {
    return LG.text.lower(LG.text.stripEdges(LG.text.normalizeCell(x)), lang);
  }

  function checkAnswer(input, expected, lang) {
    const a = prep(input, lang);
    if (a === '') return 'wrong';
    const b = prep(expected, lang);
    if (a === b) return 'correct';
    if (LG.text.fold(a, lang) === LG.text.fold(b, lang)) return 'almost';
    return 'wrong';
  }

  LG.answer = { checkAnswer };
})(globalThis.LG = globalThis.LG || {});
