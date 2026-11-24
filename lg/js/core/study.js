(function (LG) {
  function createStudySet({ by, value, game }, ids, rand) {
    return { by, value, game, queue: LG.rng.shuffle(ids, rand), total: ids.length, done: [] };
  }

  function nextIds(set, k = 1) {
    return set.queue.slice(0, k);
  }

  function recordStudy(set, id, ok) {
    const rest = set.queue.filter(x => x !== id);
    return Object.assign({}, set, ok
      ? { queue: rest, done: set.done.concat([id]) }
      : { queue: rest.concat([id]), done: set.done.slice() });
  }

  // Redo a word's study result after a re-answer: it ends up exactly as if only this answer had been recorded.
  function rerecord(set, id, ok) {
    const inQueue = set.queue.includes(id);
    const inDone = set.done.includes(id);
    if (ok ? !inQueue && inDone : inQueue && !inDone) return set;
    const queue = set.queue.filter(x => x !== id);
    const done = set.done.filter(x => x !== id);
    return Object.assign({}, set, ok
      ? { queue, done: done.concat([id]) }
      : { queue: queue.concat([id]), done });
  }

  function isFinished(set) {
    return set.queue.length === 0;
  }

  // Drop ids that are not in idSet (e.g. after a new file was loaded); null when nothing is left to study.
  function prune(set, idSet) {
    if (!set) return null;
    const queue = set.queue.filter((id) => idSet.has(id));
    if (!queue.length) return null;
    const done = set.done.filter((id) => idSet.has(id));
    return Object.assign({}, set, { queue, done, total: queue.length + done.length });
  }

  LG.study = { createStudySet, nextIds, recordStudy, rerecord, isFinished, prune };
})(globalThis.LG = globalThis.LG || {});
