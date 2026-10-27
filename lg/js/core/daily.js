(function (LG) {
  const WORD_RE = /^\p{L}{4,8}$/u;

  function dailyPool(items, rarity, lang, pins = {}) {
    const seen = new Set();
    const out = [];
    const add = (word, item) => {
      if (!WORD_RE.test(word)) return;
      const key = LG.text.lower(word, lang);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ word, clue: item.source, itemId: item.id });
    };
    for (const item of items) {
      if (LG.words.kindOf(item.target, lang) === 'sentence') {
        const cands = LG.words.clozeCandidates(item.target, rarity, lang);
        const word = pins[item.id] || (cands[0] && cands[0].text);
        if (word) add(word, item);
      } else {
        const tokens = LG.text.tokenize(item.target, lang);
        if (tokens.length === 1) add(tokens[0].text, item);
      }
    }
    return out.sort((a, b) => a.word.localeCompare(b.word, lang));
  }

  function dailyEntry(pool, iso) {
    return pool.length ? pool[LG.rng.cyrb53(iso) % pool.length] : null;
  }

  function scoreGuess(guess, answer, lang) {
    const g = Array.from(LG.text.lower(guess, lang));
    const a = Array.from(LG.text.lower(answer, lang));
    const res = a.map(() => 'grey');
    const counts = new Map();
    a.forEach((ch, i) => {
      if (g[i] === ch) res[i] = 'green';
      else counts.set(ch, (counts.get(ch) || 0) + 1);
    });
    a.forEach((_, i) => {
      if (res[i] === 'green') return;
      const c = counts.get(g[i]) || 0;
      if (c > 0) { res[i] = 'yellow'; counts.set(g[i], c - 1); }
    });
    return res;
  }

  function keyboardLetters(items, lang) {
    const base = Array.from('abcdefghijklmnopqrstuvwxyz');
    return base.concat(LG.words.specialLetters(items, lang));
  }

  LG.daily = { dailyPool, dailyEntry, scoreGuess, keyboardLetters };
})(globalThis.LG = globalThis.LG || {});
