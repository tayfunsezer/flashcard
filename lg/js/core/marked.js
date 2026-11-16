(function (LG) {
  // Starred items as quiz entries { question, options, correctIndex } that the JSON importer reads back.
  function markedQuiz(items, progress, lang, rand) {
    const pool = items.map((it) => ({ text: it.target, categories: it.categories }));
    return items.filter((it) => LG.play.isMarked(progress[it.id])).map((it) => {
      const others = it.options && it.options.length ? it.options
        : LG.distractors.pickDistractors(it.target, pool, it.categories, lang, rand, 3);
      const options = LG.rng.shuffle([it.target].concat(others), rand);
      return { question: it.source, options, correctIndex: options.indexOf(it.target) };
    });
  }

  function exportFileName(datasetName, iso) {
    let name = String(datasetName || '').trim().replace(/\.[^./\\]*$/, '').replace(/^marked-/i, '').replace(/-\d{4}-\d{2}-\d{2}$/, '').trim();
    if (!name || /^sample data$/i.test(name)) name = 'sample';
    return 'marked-' + name + '-' + iso + '.json';
  }

  LG.marked = { markedQuiz, exportFileName };
})(globalThis.LG = globalThis.LG || {});
