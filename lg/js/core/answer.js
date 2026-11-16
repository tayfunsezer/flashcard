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

  // Whole-expression check: word tokens only, so punctuation and '&' joiners are ignored.
  function checkWhole(input, expected, lang) {
    const toks = (x) => LG.text.tokenize(LG.text.normalizeCell(x), lang).map((t) => LG.text.lower(t.text, lang));
    const a = toks(input);
    const b = toks(expected);
    if (!a.length || a.length !== b.length) return 'wrong';
    if (a.every((w, i) => w === b[i])) return 'correct';
    if (a.every((w, i) => LG.text.fold(w, lang) === LG.text.fold(b[i], lang))) return 'almost';
    return 'wrong';
  }

  LG.answer = { checkAnswer, checkWhole };
})(globalThis.LG = globalThis.LG || {});
