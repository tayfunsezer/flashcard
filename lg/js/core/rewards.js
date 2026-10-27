(function (LG) {
  const DAILY_WIN_XP = 30;

  function promptXp({ result, hints }) {
    if (result === 'wrong') return 0;
    const base = Math.max(2, 10 - 3 * hints);
    return result === 'almost' ? Math.max(2, Math.floor(base / 2)) : base;
  }

  function comboMultiplier(comboAfter) {
    if (comboAfter >= 10) return 2;
    if (comboAfter >= 5) return 1.5;
    return 1;
  }

  function matchXp({ pairs, misses, seconds }) {
    return Math.max(0, Math.round(pairs * 5 + Math.max(0, 60 - seconds) / 2 - misses * 2));
  }

  function levelInfo(xp) {
    const level = Math.floor(Math.sqrt(xp / 50)) + 1;
    const floorXp = 50 * (level - 1) ** 2;
    const nextXp = 50 * level ** 2;
    return { level, floorXp, nextXp, progress: (xp - floorXp) / (nextXp - floorXp) };
  }

  function updateStreak(streak, todayIso) {
    if (streak.lastDay === todayIso) return { current: streak.current, best: streak.best, lastDay: todayIso };
    const continued = streak.lastDay && LG.dates.addDaysISO(streak.lastDay, 1) === todayIso;
    const current = continued ? streak.current + 1 : 1;
    return { current, best: Math.max(streak.best, current), lastDay: todayIso };
  }

  function medalFor(share) {
    if (share >= 0.9) return 'gold';
    if (share >= 0.6) return 'silver';
    if (share >= 0.3) return 'bronze';
    return 'none';
  }

  function categoryShare(ids, progress) {
    if (!ids.length) return 0;
    const done = ids.filter((id) => progress[id] && progress[id].box >= 3).length;
    return done / ids.length;
  }

  LG.rewards = { promptXp, comboMultiplier, matchXp, DAILY_WIN_XP, levelInfo, updateStreak, medalFor, categoryShare };
})(globalThis.LG = globalThis.LG || {});
