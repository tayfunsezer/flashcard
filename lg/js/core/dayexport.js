(function (LG) {
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

  // Dated items grouped by day, newest first.
  function datesIn(items) {
    const counts = new Map();
    for (const it of items) if (it.date) counts.set(it.date, (counts.get(it.date) || 0) + 1);
    return [...counts].map(([date, count]) => ({ date, count })).sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  // 'YYYY-MM-DD' -> ['october-2026', 'marked-words', 'marked_words-26.json'] (day not zero-padded).
  function relPath(date) {
    const [y, m, d] = date.split('-');
    return [MONTHS[Number(m) - 1] + '-' + y, 'marked-words', 'marked_words-' + Number(d) + '.json'];
  }

  // Every word of one day as quiz entries, in file order.
  function dayQuiz(items, date, lang, rand) {
    return LG.marked.quizEntries(items, items.filter((it) => it.date === date), lang, rand);
  }

  async function fileExists(root, parts) {
    try {
      let dir = root;
      for (const name of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(name);
      await dir.getFileHandle(parts[parts.length - 1]);
      return true;
    } catch (e) {
      if (e && e.name === 'NotFoundError') return false;
      throw e;
    }
  }

  // Write text to root/parts, creating folders. Looks first: an existing file is left alone unless overwrite.
  async function writeToRepo(rootDir, parts, text, overwrite) {
    if (!overwrite && await fileExists(rootDir, parts)) return 'exists';
    let dir = rootDir;
    for (const name of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(name, { create: true });
    const file = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    const out = await file.createWritable();
    await out.write(text);
    await out.close();
    return 'written';
  }

  LG.dayexport = { datesIn, relPath, dayQuiz, writeToRepo };
})(globalThis.LG = globalThis.LG || {});
