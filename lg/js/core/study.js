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

  LG.study = { createStudySet, nextIds, recordStudy, isFinished, prune };
})(globalThis.LG = globalThis.LG || {});
