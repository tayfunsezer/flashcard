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

  function compareTokens(a, b, lang) {
    if (!a.length || a.length !== b.length) return 'wrong';
    if (a.every((w, i) => w === b[i])) return 'correct';
    if (a.every((w, i) => LG.text.fold(w, lang) === LG.text.fold(b[i], lang))) return 'almost';
    return 'wrong';
  }

  const RANK = { wrong: 0, almost: 1, correct: 2 };

  // Whole-expression check: word tokens only, so punctuation and '&' joiners are ignored.
  // Words in parentheses are optional: "bać się" and "bać się czegoś" both match "bać się (czegoś)".
  function checkWhole(input, expected, lang) {
    const toks = (x) => LG.text.tokenize(LG.text.normalizeCell(x), lang).map((t) => LG.text.lower(t.text, lang));
    const a = toks(input);
    const targets = [toks(expected), toks(LG.text.stripParens(LG.text.normalizeCell(expected)))];
    let best = 'wrong';
    for (const b of targets) {
      if (!b.length) continue;
      const r = compareTokens(a, b, lang);
      if (RANK[r] > RANK[best]) best = r;
    }
    return best;
  }

  LG.answer = { checkAnswer, checkWhole };
})(globalThis.LG = globalThis.LG || {});
