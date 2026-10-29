(function (LG) {
  const { h } = LG.dom;

  function playable(game, ids) {
    const ctx = LG.app.ctx;
    if (game === 'mc' && ctx.mcIds.size < LG.play.MC_OPTIONS) return false;
    return LG.play.eligibleIds(ids.map((id) => ctx.itemsById.get(id)), game, ctx.langTarget, ctx.mcIds).length > 0;
  }

  LG.screens.summary = {
    // params: { game, mode, xp, correct, almost, wrong, moved: [{ id, from, to }], missed: id[], again }
    render(root, p) {
      const app = LG.app;
      const set = app.state.studySet;
      const studyOpen = p.mode === 'study' && set && set.game === p.game;
      const lv = LG.rewards.levelInfo(app.state.xp);
      const moved = (p.moved || []).filter((m) => app.ctx.itemsById.has(m.id));
      const missed = (p.missed || []).filter((id) => app.ctx.itemsById.has(id));
      // With missed words, practising them is the primary action and the usual buttons step back.
      const mainCls = missed.length ? 'btn' : 'btn btn-primary';
      // Practise the missed words in the same game; a game that cannot run on them (e.g. Multiple Choice
      // without four options) falls back to Flashcards.
      const practiceGame = playable(p.game, missed) ? p.game : 'flashcards';
      const practice = (game) => () => app.go(game, { ids: LG.play.startRound(missed), mode: 'review' });
      const count = (label, n, cls) => h('div', { class: 'count ' + cls }, h('strong', null, String(n)), h('span', null, label));

      root.append(h('div', { class: 'screen' },
        h('div', { class: 'topbar' }, h('h1', null, app.TITLES[p.game] + ' — round complete')),
        h('div', { class: 'card stack' },
          h('div', { class: 'spread' },
            h('span', { class: 'xp-gained' }, '+' + p.xp + ' XP'),
            h('span', { class: 'muted small' }, 'Level ' + lv.level + ' · ' + app.state.xp + ' / ' + lv.nextXp + ' XP')),
          h('div', { class: 'counts' },
            count('correct', p.correct || 0, 'c-ok'), count('almost', p.almost || 0, 'c-almost'), count('wrong', p.wrong || 0, 'c-bad')),
          p.mode === 'study' && !studyOpen ? h('p', { class: 'muted' }, 'Study set finished.') : null),
        // Actions sit above the moved list: an uncapped round can move many words.
        h('div', { class: 'btn-row summary-actions' },
          missed.length
            ? h('button', { class: 'btn btn-primary', type: 'button', onclick: practice(practiceGame) },
              'Practice the ' + missed.length + (missed.length === 1 ? ' word' : ' words') + ' you missed')
            : null,
          missed.length && practiceGame !== 'flashcards'
            ? h('button', { class: 'btn', type: 'button', onclick: practice('flashcards') }, 'Practice them as Flashcards')
            : null,
          p.mode === 'leitner'
            ? h('button', { class: mainCls, type: 'button', onclick: () => app.go('leitner') }, 'Back to Leitner boxes')
            : studyOpen
            ? h('button', { class: mainCls, type: 'button', onclick: p.again }, 'Continue set (' + set.done.length + '/' + set.total + ')')
            : p.mode === 'study' ? null : h('button', { class: mainCls, type: 'button', onclick: p.again }, 'Play again'),
          h('button', { class: 'btn', type: 'button', onclick: () => app.go('home') }, 'Home')),
        h('div', { class: 'card' },
          h('h2', null, 'Moved boxes'),
          moved.length
            ? h('ul', { class: 'moved' }, moved.map((m) => {
              const it = app.ctx.itemsById.get(m.id);
              return h('li', null,
                h('span', { class: 'moved-text' }, h('span', { lang: app.ctx.langSource }, it.source), ' → ', h('span', { lang: app.ctx.langTarget }, it.target)),
                h('span', { class: 'moved-box ' + (m.to > m.from ? 'up' : 'down') }, 'box ' + m.from + ' → ' + m.to));
            }))
            : h('p', { class: 'muted' }, 'No items changed box.'))));
      const first = root.querySelector('.btn-primary') || root.querySelector('.btn');
      if (first) first.focus();
    },
  };
})(globalThis.LG = globalThis.LG || {});
