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

  LG.round = { create, current, isFirst, record, drop, missed, progress, isDone, MAX_REPEATS };
})(globalThis.LG = globalThis.LG || {});
