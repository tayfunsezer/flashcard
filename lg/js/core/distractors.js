(function (LG) {
  const CLOSEST = 6;

  function pickDistractors(correct, pool, categories, lang, rand, n = 3) {
    const target = LG.text.lower(correct, lang);
    const len = LG.text.charLength(correct);
    const seen = new Set([target]);
    const same = [];
    const other = [];
    for (const e of pool) {
      const key = LG.text.lower(e.text, lang);
      if (seen.has(key)) continue;
      seen.add(key);
      (e.categories.some((c) => categories.includes(c)) ? same : other).push(e.text);
    }
    const closest = (arr) => arr
      .map((t, i) => ({ t, i, d: Math.abs(LG.text.charLength(t) - len) }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .slice(0, CLOSEST)
      .map((x) => x.t);
    const out = LG.rng.shuffle(closest(same), rand).slice(0, n);
    if (out.length < n) out.push(...LG.rng.shuffle(closest(other), rand).slice(0, n - out.length));
    return out;
  }

  LG.distractors = { pickDistractors };
})(globalThis.LG = globalThis.LG || {});
