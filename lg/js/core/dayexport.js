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

  // Where a day's file may live in the repeated-words folder, best guess first. The learner's files mix '-' and '_'
  // in folder and file names, so both spellings are tried; marked words of day 1 may have no day suffix.
  const REPO_NAMES = {
    marked: { folders: ['marked-words', 'marked_words'], stems: ['marked_words', 'marked-words'], bareDay1: true },
    special: { folders: ['special-attention', 'special_attention'], stems: ['special-attention', 'special_attention'], bareDay1: false },
  };

  // 'YYYY-MM-DD', 'marked'|'special' -> [[monthFolder, typeFolder, fileName], ...]
  function repoCandidates(date, type) {
    const spec = REPO_NAMES[type];
    const [y, m, d] = date.split('-');
    const month = MONTHS[Number(m) - 1] + '-' + y;
    const day = Number(d);
    const out = [];
    for (const folder of spec.folders) for (const stem of spec.stems) out.push([month, folder, stem + '-' + day + '.json']);
    if (spec.bareDay1 && day === 1) for (const folder of spec.folders) for (const stem of spec.stems) out.push([month, folder, stem + '.json']);
    return out;
  }

  // The first candidate that exists under rootDir: { file, parts }, or null. Only NotFoundError means "try the next".
  async function findInRepo(rootDir, date, type) {
    for (const parts of repoCandidates(date, type)) {
      try {
        let dir = rootDir;
        for (const name of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(name);
        const handle = await dir.getFileHandle(parts[parts.length - 1]);
        return { file: await handle.getFile(), parts };
      } catch (e) {
        if (!e || e.name !== 'NotFoundError') throw e;
      }
    }
    return null;
  }

  // Does the month folder of this date exist under rootDir? False hints at a wrong or moved folder.
  async function monthFolderExists(rootDir, date) {
    try {
      await rootDir.getDirectoryHandle(repoCandidates(date, 'marked')[0][0]);
      return true;
    } catch (e) {
      if (e && e.name === 'NotFoundError') return false;
      throw e;
    }
  }

  LG.dayexport = { datesIn, relPath, dayQuiz, writeToRepo, repoCandidates, findInRepo, monthFolderExists };
})(globalThis.LG = globalThis.LG || {});
