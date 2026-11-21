(function (LG) {
  const FOLD_MAP = {
    'ı': 'i', 'İ': 'i', 'ł': 'l', 'Ł': 'l', 'ø': 'o', 'Ø': 'o', 'đ': 'd', 'Đ': 'd',
    'ß': 'ss', 'æ': 'ae', 'Æ': 'ae', 'œ': 'oe', 'Œ': 'oe',
  };
  const FOLD_RE = /[ıİłŁøØđĐßæÆœŒ]/g;
  const EDGE_RE = /^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu;
  const DENSE_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

  function normalizeCell(v) {
    if (v === null || v === undefined) return '';
    return String(v).normalize('NFC').trim().replace(/\s+/g, ' ');
  }

  function lower(s, lang) {
    return s.toLocaleLowerCase(lang || undefined);
  }

  function fold(s, lang) {
    const base = lower(s, lang).normalize('NFD').replace(/\p{M}/gu, '');
    return lower(base.replace(FOLD_RE, (c) => FOLD_MAP[c]), lang);
  }

  function stripEdges(s) {
    return s.replace(EDGE_RE, '');
  }

  function tokenize(s, lang) {
    const seg = new Intl.Segmenter(lang || undefined, { granularity: 'word' });
    const out = [];
    for (const part of seg.segment(s)) {
      if (part.isWordLike) out.push({ text: part.segment, index: part.index });
    }
    return out;
  }

  // [start, end) of each top-level "(…)" group; an unclosed "(" is not a group.
  function parenRanges(s) {
    const out = [];
    let depth = 0;
    let start = -1;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') { if (depth++ === 0) start = i; }
      else if (s[i] === ')' && depth > 0 && --depth === 0) out.push([start, i + 1]);
    }
    return out;
  }

  function inParens(index, ranges) {
    return ranges.some(([a, b]) => index >= a && index < b);
  }

  // "bać się (czegoś)" -> "bać się": the optional part of an expression removed.
  function stripParens(s) {
    const ranges = parenRanges(s);
    if (!ranges.length) return s;
    let out = '';
    let at = 0;
    for (const [a, b] of ranges) { out += s.slice(at, a) + ' '; at = b; }
    return normalizeCell(out + s.slice(at));
  }

  function charLength(s) {
    return Array.from(s).length;
  }

  function isDenseScript(s) {
    return DENSE_RE.test(s);
  }

  // Lower-cases word, then capitalises its first letter when model starts with an uppercase letter.
  function matchCase(word, model, lang) {
    const low = lower(word, lang);
    const m = Array.from(model || '')[0];
    if (!m || m === lower(m, lang) || m !== m.toLocaleUpperCase(lang || undefined)) return low;
    const chars = Array.from(low);
    if (!chars.length) return low;
    return chars[0].toLocaleUpperCase(lang || undefined) + chars.slice(1).join('');
  }

  LG.text = { normalizeCell, lower, fold, stripEdges, tokenize, parenRanges, inParens, stripParens, charLength, isDenseScript, matchCase };
})(globalThis.LG = globalThis.LG || {});
