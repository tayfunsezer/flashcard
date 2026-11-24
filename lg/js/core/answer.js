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

  // Word-by-word comparison for feedback: which typed words are ok / accent-only / wrong, and which expected words were left out.
  // Words in parentheses are optional: the better-matching of the full and the bracket-free expected text is used.
  function align(a, b, lang) {
    const n = a.length;
    const m = b.length;
    const sub = (i, j) => (a[i].low === b[j].low ? 0 : LG.text.fold(a[i].low, lang) === LG.text.fold(b[j].low, lang) ? 0.5 : 1);
    const D = [];
    for (let i = 0; i <= n; i++) D.push(new Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) D[i][0] = i;
    for (let j = 1; j <= m; j++) D[0][j] = j;
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j - 1] + sub(i - 1, j - 1), D[i - 1][j] + 1, D[i][j - 1] + 1);
    }
    const typed = [];
    const missing = [];
    let i = n;
    let j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + sub(i - 1, j - 1)) {
        const c = sub(i - 1, j - 1);
        typed.push({ text: a[i - 1].text, status: c === 0 ? 'ok' : c === 0.5 ? 'almost' : 'wrong' });
        i--; j--;
      } else if (i > 0 && D[i][j] === D[i - 1][j] + 1) {
        typed.push({ text: a[i - 1].text, status: 'wrong' });
        i--;
      } else {
        missing.push(b[j - 1].text);
        j--;
      }
    }
    return { cost: D[n][m], typed: typed.reverse(), missing: missing.reverse() };
  }

  function diffWords(input, expected, lang) {
    const toks = (x) => LG.text.tokenize(LG.text.normalizeCell(x), lang).map((t) => ({ text: t.text, low: LG.text.lower(t.text, lang) }));
    const a = toks(input);
    let best = align(a, toks(expected), lang);
    const bare = toks(LG.text.stripParens(LG.text.normalizeCell(expected)));
    if (bare.length) {
      const alt = align(a, bare, lang);
      if (alt.cost < best.cost) best = alt;
    }
    return { typed: best.typed, missing: best.missing };
  }

  LG.answer = { checkAnswer, checkWhole, diffWords };
})(globalThis.LG = globalThis.LG || {});
