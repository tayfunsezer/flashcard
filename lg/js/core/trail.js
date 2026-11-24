(function (LG) {
  // Back/forward history of the words shown in one game screen. Entries may repeat (a missed word comes back).
  function create() {
    return { ids: [], pos: -1 };
  }

  function push(t, id) {
    return { ids: t.ids.concat([id]), pos: t.ids.length };
  }

  function current(t) {
    return t.pos >= 0 ? t.ids[t.pos] : null;
  }

  function canBack(t) {
    return t.pos > 0;
  }

  function canForward(t) {
    return t.pos >= 0 && t.pos < t.ids.length - 1;
  }

  function back(t) {
    return canBack(t) ? { ids: t.ids, pos: t.pos - 1 } : null;
  }

  function forward(t) {
    return canForward(t) ? { ids: t.ids, pos: t.pos + 1 } : null;
  }

  // The file was refreshed: `map` renames edited words, `removed` are words no longer in the file.
  // The position stays on the same word, or on the next one when that word is gone.
  function remap(t, map, removed) {
    const ids = [];
    let pos = 0;
    t.ids.forEach((id, i) => {
      if (removed.has(id)) return;
      if (i < t.pos) pos++;
      ids.push(map.has(id) ? map.get(id) : id);
    });
    return { ids, pos: ids.length ? Math.min(pos, ids.length - 1) : -1 };
  }

  LG.trail = { create, push, current, canBack, canForward, back, forward, remap };
})(globalThis.LG = globalThis.LG || {});
