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

  function bannerText(fileName, d) {
    return 'Refreshed ' + fileName + ': ' + d.total + ' items (+' + d.added + ' new, −' + d.removed + ' gone)';
  }

  LG.reload = { reparse, diff, bannerText };
})(globalThis.LG = globalThis.LG || {});
