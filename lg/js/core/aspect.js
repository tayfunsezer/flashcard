(function (LG) {
  // Verb aspect pairs: rows whose target reads "verb (impf.) & verb (pf.) extras" (either order).
  const RE = /^(.+?) \((impf|pf)\.\) & (.+?) \((impf|pf)\.\)(?: (.*))?$/i;
  const SHORT = { impf: 'impf.', pf: 'pf.' };

  function parse(target) {
    const m = RE.exec(LG.text.normalizeCell(String(target == null ? '' : target)));
    if (!m) return null;
    const a = m[2].toLowerCase();
    const b = m[4].toLowerCase();
    if (a === b) return null;
    const verbs = { [a]: m[1].trim(), [b]: m[3].trim() };
    return { impf: verbs.impf, pf: verbs.pf, extras: (m[5] || '').trim() };
  }

  function pairIds(items) {
    return items.filter((it) => parse(it.target)).map((it) => it.id);
  }

  // id -> 'impf-pf' | 'pf-impf'. Random: half each way (the odd one out falls either way), shuffled.
  function directions(ids, mode, rand) {
    let dirs;
    if (mode === 'random') {
      const n = ids.length;
      const first = Math.ceil(n / 2);
      dirs = LG.rng.shuffle(Array.from({ length: n }, (_, i) => (i < first ? 'impf-pf' : 'pf-impf')), rand);
    } else {
      dirs = ids.map(() => mode);
    }
    return new Map(ids.map((id, i) => [id, dirs[i]]));
  }

  function card(item, dir, mode) {
    const p = parse(item.target);
    if (!p) return null;
    const fromImpf = dir === 'impf-pf';
    return {
      impf: p.impf, pf: p.pf, extras: p.extras, english: item.source, dir,
      shown: fromImpf ? p.impf : p.pf,
      shownAspect: mode === 'random' ? null : SHORT[fromImpf ? 'impf' : 'pf'],
      answer: fromImpf ? p.pf : p.impf,
      answerAspect: SHORT[fromImpf ? 'pf' : 'impf'],
    };
  }

  // Typing the partner verb alone, or followed by the row's extras, is right.
  function answers(c) {
    return c.extras ? [c.answer, c.answer + ' ' + c.extras] : [c.answer];
  }

  const RANK = { wrong: 0, almost: 1, correct: 2 };

  function grade(typed, c, lang) {
    let best = 'wrong';
    for (const exp of answers(c)) {
      const r = LG.answer.checkWhole(typed, exp, lang);
      if (RANK[r] > RANK[best]) best = r;
    }
    return best;
  }

  function reveal(c) {
    return c.impf + ' (impf.) & ' + c.pf + ' (pf.)' + (c.extras ? ' ' + c.extras : '');
  }

  LG.aspect = { parse, pairIds, directions, card, answers, grade, reveal };
})(globalThis.LG = globalThis.LG || {});
