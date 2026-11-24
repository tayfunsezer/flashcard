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

  LG.trail = { create, push, current, canBack, canForward, back, forward };
})(globalThis.LG = globalThis.LG || {});
