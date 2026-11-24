(function (LG) {
  // In-round relearning: a missed word goes to the end of the queue until answered right (at most MAX_REPEATS times).
  const MAX_REPEATS = 3;

  function create(ids) {
    return { queue: ids.slice(), first: {}, repeats: {}, total: ids.length };
  }

  function current(r) {
    return r.queue.length ? r.queue[0] : null;
  }

  function isFirst(r, id) {
    return !Object.prototype.hasOwnProperty.call(r.first, id);
  }

  function record(r, id, result) {
    const first = Object.assign({}, r.first);
    const repeats = Object.assign({}, r.repeats);
    if (isFirst(r, id)) first[id] = result;
    const rest = r.queue.filter((x) => x !== id);
    let queue = rest;
    if (result === 'wrong' && (repeats[id] || 0) < MAX_REPEATS) {
      queue = rest.concat([id]);
      repeats[id] = (repeats[id] || 0) + 1;
    }
    return { queue, first, repeats, total: r.total };
  }

  // Put a word at the end of the queue without answering it (the learner skipped it for now).
  function defer(r, id) {
    if (!r.queue.includes(id)) return r;
    return Object.assign({}, r, { queue: r.queue.filter((x) => x !== id).concat([id]) });
  }

  function canDefer(r) {
    return r.queue.length > 1;
  }

  // The learner answered a word again after going back to it: the new answer is the one that counts.
  function reanswer(r, id, result) {
    const first = Object.assign({}, r.first, { [id]: result });
    const repeats = Object.assign({}, r.repeats);
    const rest = r.queue.filter((x) => x !== id);
    let queue = rest;
    if (result === 'wrong') {
      if (r.queue.includes(id)) queue = r.queue;
      else if ((repeats[id] || 0) < MAX_REPEATS) { queue = rest.concat([id]); repeats[id] = (repeats[id] || 0) + 1; }
    }
    return { queue, first, repeats, total: r.total };
  }

  // The file was refreshed: `map` renames edited words, `removed` are words no longer in the file.
  function remap(r, map, removed) {
    const ren = (id) => (map.has(id) ? map.get(id) : id);
    const inRound = new Set(r.queue.concat(Object.keys(r.first)));
    let gone = 0;
    for (const id of removed) if (inRound.has(id)) gone++;
    const keep = (obj) => {
      const out = {};
      for (const k of Object.keys(obj)) if (!removed.has(k)) out[ren(k)] = obj[k];
      return out;
    };
    return { queue: r.queue.filter((id) => !removed.has(id)).map(ren), first: keep(r.first), repeats: keep(r.repeats), total: r.total - gone };
  }

  // Leave the round without an answer (e.g. a Multiple Choice item that cannot show four options).
  function drop(r, id) {
    return Object.assign({}, r, { queue: r.queue.filter((x) => x !== id) });
  }

  // First-answer order: item ids are non-numeric strings ("i…"), so object keys keep insertion order.
  function missed(r) {
    return Object.keys(r.first).filter((id) => r.first[id] === 'wrong');
  }

  function progress(r) {
    return { done: r.total - r.queue.length, total: r.total };
  }

  function isDone(r) {
    return r.queue.length === 0;
  }

  LG.round = { create, current, isFirst, record, defer, canDefer, reanswer, remap, drop, missed, progress, isDone, MAX_REPEATS };
})(globalThis.LG = globalThis.LG || {});
