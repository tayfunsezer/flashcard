(function (LG) {
  const BOXES = [0, 1, 2, 3, 4, 5];

  function endOfLocalDay(ms) {
    const d = new Date(ms);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  function boxOf(entry) {
    if (!entry || !entry.seen) return 'new';
    return entry.box || 0;
  }

  function isDue(entry, end) {
    return boxOf(entry) !== 'new' && entry.due <= end;
  }

  function board(ids, progress, nowMs) {
    const end = endOfLocalDay(nowMs);
    const boxes = BOXES.map((box) => ({ box, count: 0, due: 0 }));
    let fresh = 0;
    for (const id of ids) {
      const e = progress[id];
      const b = boxOf(e);
      if (b === 'new') { fresh += 1; continue; }
      boxes[b].count += 1;
      if (isDue(e, end)) boxes[b].due += 1;
    }
    return { new: { count: fresh }, boxes };
  }

  function dueIds(ids, progress, nowMs) {
    const end = endOfLocalDay(nowMs);
    return ids.filter((id) => isDue(progress[id], end))
      .sort((a, b) => boxOf(progress[a]) - boxOf(progress[b]) || progress[a].due - progress[b].due);
  }

  function idsInBox(ids, progress, box) {
    return ids.filter((id) => boxOf(progress[id]) === box);
  }

  LG.leitner = { BOXES, endOfLocalDay, boxOf, board, dueIds, idsInBox };
})(globalThis.LG = globalThis.LG || {});
