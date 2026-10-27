(function (LG) {
  const DAY_MS = 86400000;
  const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];

  function applyResult(entry, result, nowMs) {
    const e = entry || {};
    const prev = e.box || 0;
    const ok = result === 'correct' || result === 'almost';
    const box = ok ? Math.min(5, prev + 1) : 0;
    return {
      box,
      due: nowMs + INTERVAL_DAYS[box] * DAY_MS,
      revenge: !ok,
      seen: true,
      pin: e.pin === undefined ? null : e.pin,
      rot: e.rot || 0,
    };
  }

  function buildReviewRound(ids, progress, nowMs, n = 10, rand) {
    const seen = id => !!(progress[id] && progress[id].seen);
    const due = ids.filter(id => seen(id) && progress[id].due <= nowMs)
      .sort((a, b) => (progress[a].box || 0) - (progress[b].box || 0) || progress[a].due - progress[b].due);
    const unseen = LG.rng.shuffle(ids.filter(id => !seen(id)), rand);
    const rest = LG.rng.shuffle(ids.filter(id => seen(id) && !(progress[id].due <= nowMs)), rand);
    return due.concat(unseen, rest).slice(0, n);
  }

  function revengeIds(ids, progress) {
    return ids.filter(id => progress[id] && progress[id].revenge);
  }

  LG.schedule = { DAY_MS, INTERVAL_DAYS, applyResult, buildReviewRound, revengeIds };
})(globalThis.LG = globalThis.LG || {});
