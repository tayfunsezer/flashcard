(function (LG) {
  const MIN_SENTENCE_TOKENS = 4;
  const NUMERIC_RE = /^\p{N}+$/u;
  const MAX_CANDIDATES = 3;

  function kindOf(target, lang) {
    return LG.text.tokenize(target, lang).length >= MIN_SENTENCE_TOKENS ? 'sentence' : 'term';
  }

  function buildRarity(items, lang) {
    const freq = new Map();
    for (const item of items) {
      const seen = new Set();
      for (const t of LG.text.tokenize(item.target, lang)) seen.add(LG.text.lower(t.text, lang));
      for (const w of seen) freq.set(w, (freq.get(w) || 0) + 1);
    }
    return freq;
  }

  function clozeCandidates(target, rarity, lang) {
    const tokens = LG.text.tokenize(target, lang);
    if (!tokens.length) return [];
    const seen = new Set();
    const eligible = [];
    for (const t of tokens) {
      const key = LG.text.lower(t.text, lang);
      if (seen.has(key)) continue;
      seen.add(key);
      const len = LG.text.charLength(t.text);
      const min = LG.text.isDenseScript(t.text) ? 2 : 4;
      if (len >= min && !NUMERIC_RE.test(t.text)) {
        eligible.push({ text: t.text, index: t.index, rar: rarity.get(key) || 0, len });
      }
    }
    if (!eligible.length) {
      let best = tokens[0];
      for (const t of tokens) {
        if (LG.text.charLength(t.text) > LG.text.charLength(best.text)) best = t;
      }
      return [{ text: best.text, index: best.index }];
    }
    eligible.sort((a, b) => a.rar - b.rar || b.len - a.len || a.index - b.index);
    return eligible.slice(0, MAX_CANDIDATES).map((c) => ({ text: c.text, index: c.index }));
  }

  function pickBlank(item, entry, rarity, lang) {
    const e = entry || {};
    if (e.pin) {
      const pin = LG.text.lower(e.pin, lang);
      const hit = LG.text.tokenize(item.target, lang).find((t) => LG.text.lower(t.text, lang) === pin);
      if (hit) return { text: hit.text, index: hit.index };
    }
    const cands = clozeCandidates(item.target, rarity, lang);
    return cands[(e.rot || 0) % cands.length];
  }

  function hintText(word, level) {
    const chars = Array.from(word);
    if (level <= 0 || !chars.length) return '';
    if (level === 1) return chars[0] + '…';
    if (level === 2) return chars[0] + ' _'.repeat(chars.length - 1);
    return chars.map((c, i) => (i % 2 === 0 ? c : '_')).join(' ');
  }

  function specialLetters(items, lang) {
    const set = new Set();
    for (const item of items) {
      for (const ch of LG.text.lower(item.target, lang)) {
        if (/\p{L}/u.test(ch) && !/[a-z]/.test(ch)) set.add(ch);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, lang));
  }

  function filterItems(items, { dateFrom, dateTo, categories } = {}) {
    const cats = categories && categories.length ? new Set(categories) : null;
    const dated = Boolean(dateFrom || dateTo);
    return items.filter((i) => {
      if (dated) {
        if (i.date === null || i.date === undefined) return false;
        if (dateFrom && i.date < dateFrom) return false;
        if (dateTo && i.date > dateTo) return false;
      }
      return !cats || i.categories.some((c) => cats.has(c));
    });
  }

  function groupOptions(items) {
    const cats = new Map();
    const dates = new Map();
    for (const i of items) {
      for (const c of i.categories) cats.set(c, (cats.get(c) || 0) + 1);
      if (i.date) dates.set(i.date, (dates.get(i.date) || 0) + 1);
    }
    return {
      categories: [...cats].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
      dates: [...dates].map(([date, count]) => ({ date, count })).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    };
  }

  function itemsInCategory(items, name) {
    return items.filter((i) => i.categories.includes(name));
  }

  function searchCategories(options, query, lang, limit = 50) {
    const byCount = (a, b) => b.count - a.count || a.name.localeCompare(b.name);
    const q = LG.text.fold(String(query || '').trim(), lang);
    if (!q) return options.slice().sort(byCount).slice(0, limit);
    const starts = [];
    const contains = [];
    for (const o of options) {
      const idx = LG.text.fold(o.name, lang).indexOf(q);
      if (idx === 0) starts.push(o);
      else if (idx > 0) contains.push(o);
    }
    return starts.sort(byCount).concat(contains.sort(byCount)).slice(0, limit);
  }

  LG.words = { MIN_SENTENCE_TOKENS, kindOf, buildRarity, clozeCandidates, pickBlank, hintText, specialLetters, filterItems, groupOptions, itemsInCategory, searchCategories };
})(globalThis.LG = globalThis.LG || {});
