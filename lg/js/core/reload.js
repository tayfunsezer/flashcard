(function (LG) {
  const NO_ROWS = 'No rows with both a Source and a Target were found.';
  const NO_ENTRIES = 'No valid quiz entries were found.';

  // Re-read a file's parsed contents (from LG.importer.readFile) into a dataset, or explain why not.
  function reparse(read, fileName, learnColumn) {
    let res;
    try {
      res = read.json !== undefined
        ? LG.importer.jsonToDataset(read.json, fileName)
        : LG.importer.rowsToDataset(read.rows || [], { learnColumn });
    } catch (e) {
      return { ok: false, error: (e && e.message) || String(e) };
    }
    if (!res.items.length) return { ok: false, error: read.json !== undefined ? NO_ENTRIES : NO_ROWS };
    return { ok: true, dataset: { items: res.items, fileName, importedAt: Date.now(), encoding: read.encoding, learnColumn } };
  }

  // Counts by id: items in the new list, ids new to it, ids no longer in it.
  function diff(oldItems, newItems) {
    const oldIds = new Set(oldItems.map((it) => it.id));
    const newIds = new Set(newItems.map((it) => it.id));
    let added = 0;
    let removed = 0;
    for (const id of newIds) if (!oldIds.has(id)) added++;
    for (const id of oldIds) if (!newIds.has(id)) removed++;
    return { total: newItems.length, added, removed };
  }

  // `edited`: rows whose progress was carried to their corrected version; they are not counted as new or gone.
  function bannerText(fileName, d, edited = 0) {
    const tail = edited > 0 ? ', ' + edited + ' edited' : '';
    return 'Refreshed ' + fileName + ': ' + d.total + ' items (+' + (d.added - edited) + ' new, −' + (d.removed - edited) + ' gone' + tail + ')';
  }

  // Edited rows: a row that left the file and a row that is new, sharing the same source or the same target.
  // Paired only when each is the other's single candidate; anything ambiguous carries nothing.
  function carryOver(oldItems, newItems) {
    const norm = LG.text.normalizeCell;
    const oldIds = new Set(oldItems.map((it) => it.id));
    const newIds = new Set(newItems.map((it) => it.id));
    const gone = oldItems.filter((it) => !newIds.has(it.id));
    const fresh = newItems.filter((it) => !oldIds.has(it.id));
    const alike = (a, b) => norm(a.source) === norm(b.source) || norm(a.target) === norm(b.target);
    const pairs = [];
    for (const g of gone) {
      const cands = fresh.filter((f) => alike(g, f));
      if (cands.length !== 1) continue;
      const f = cands[0];
      if (gone.filter((x) => alike(x, f)).length !== 1) continue;
      pairs.push({ from: g.id, to: f.id, targetChanged: norm(g.target) !== norm(f.target) });
    }
    return pairs;
  }

  // Moves each carried row's progress (box, due, star, ...) to its new id; a pin names words of the old sentence,
  // so it is dropped when the target changed. An existing entry for the new id wins.
  function carryState(state, pairs) {
    if (!pairs.length) return state;
    const progress = Object.assign({}, state.progress);
    for (const p of pairs) {
      const e = progress[p.from];
      if (!e) continue;
      delete progress[p.from];
      if (!(p.to in progress)) progress[p.to] = p.targetChanged ? Object.assign({}, e, { pin: null }) : e;
    }
    const map = new Map(pairs.map((p) => [p.from, p.to]));
    return Object.assign({}, state, { progress, studySet: state.studySet ? LG.study.remap(state.studySet, map) : state.studySet });
  }

  LG.reload = { reparse, diff, bannerText, carryOver, carryState };
})(globalThis.LG = globalThis.LG || {});
