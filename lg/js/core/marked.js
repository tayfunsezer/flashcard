(function (LG) {
  // Quiz entries { question, options, correctIndex } for `selected` items; distractors come from every item in `items`.
  function quizEntries(items, selected, lang, rand) {
    const pool = items.map((it) => ({ text: it.target, categories: it.categories }));
    return selected.map((it) => {
      const others = it.options && it.options.length ? it.options
        : LG.distractors.pickDistractors(it.target, pool, it.categories, lang, rand, 3);
      const options = LG.rng.shuffle([it.target].concat(others), rand);
      return { question: it.source, options, correctIndex: options.indexOf(it.target) };
    });
  }

  // Starred items as quiz entries that the JSON importer reads back.
  function markedQuiz(items, progress, lang, rand) {
    return quizEntries(items, items.filter((it) => LG.play.isMarked(progress[it.id])), lang, rand);
  }

  // The starred items, in file order (what the Manage marked screen lists).
  function markedItems(items, progress) {
    return items.filter((it) => LG.play.isMarked(progress[it.id]));
  }

  function exportFileName(datasetName, iso) {
    let name = String(datasetName || '').trim().replace(/\.[^./\\]*$/, '').replace(/^marked-/i, '').replace(/-\d{4}-\d{2}-\d{2}$/, '').trim();
    if (!name || /^sample data$/i.test(name)) name = 'sample';
    return 'marked-' + name + '-' + iso + '.json';
  }

  LG.marked = { quizEntries, markedQuiz, markedItems, exportFileName };
})(globalThis.LG = globalThis.LG || {});
