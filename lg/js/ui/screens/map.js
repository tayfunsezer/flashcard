(function (LG) {
  const { h } = LG.dom;
  const MEDAL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

  function tile(cat, items, app) {
    const ids = LG.words.itemsInCategory(items, cat.name).map((it) => it.id);
    const share = LG.rewards.categoryShare(ids, app.state.progress);
    const medal = LG.rewards.medalFor(share);
    const pct = Math.round(share * 100);
    const revenge = LG.schedule.revengeIds(ids, app.state.progress).length;
    return h('button', { class: 'btn tile', type: 'button', onclick: () => {
      app.filters.categories = [cat.name];
      app.go('home');
    } },
      h('strong', { class: 'tile-name' }, cat.name),
      h('span', { class: 'muted small' }, cat.count + (cat.count === 1 ? ' item' : ' items')),
      h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': 'Share of items known well' },
        h('span', { style: 'width:' + pct + '%' })),
      h('span', { class: 'small' }, pct + '% known well'),
      medal === 'none' ? null : h('span', { class: 'medal medal-' + medal }, h('i', { class: 'medal-dot', 'aria-hidden': 'true' }), MEDAL[medal]),
      h('span', { class: 'muted small' }, 'Revenge: ' + revenge));
  }

  const PAGE = 60;
  const SORTS = [['items', 'Most items'], ['name', 'Name'], ['known', 'Least known'], ['revenge', 'Most revenge']];

  // Per-category stats once per render, so sorting 300+ categories stays cheap.
  function statsFor(cats, app) {
    const by = new Map(cats.map((c) => [c.name, []]));
    for (const it of app.ctx.items) for (const c of it.categories) by.get(c).push(it.id);
    return cats.map((c) => {
      const ids = by.get(c.name);
      return { cat: c, share: LG.rewards.categoryShare(ids, app.state.progress), revenge: LG.schedule.revengeIds(ids, app.state.progress).length };
    });
  }

  LG.screens.map = {
    render(root) {
      const app = LG.app;
      const lang = app.ctx.langTarget;
      const cats = LG.words.groupOptions(app.ctx.items).categories;
      const stats = statsFor(cats, app);
      const byName = (a, b) => a.cat.name.localeCompare(b.cat.name);
      const cmp = {
        items: (a, b) => b.cat.count - a.cat.count || byName(a, b),
        name: byName,
        known: (a, b) => a.share - b.share || byName(a, b),
        revenge: (a, b) => b.revenge - a.revenge || byName(a, b),
      };
      let query = '';
      let sort = 'items';
      let shown = PAGE;
      const grid = h('div', { class: 'grid' });
      const count = h('span', { class: 'muted small', role: 'status' });
      const more = h('button', { class: 'btn', type: 'button', onclick: () => { shown += PAGE; draw(); } }, 'Show more');
      const moreRow = h('div', { class: 'center-row' }, more);

      const draw = () => {
        const q = LG.text.fold(query.trim(), lang);
        const rows = stats.filter((r) => !q || LG.text.fold(r.cat.name, lang).includes(q)).sort(cmp[sort]);
        LG.dom.clear(grid).append(...rows.slice(0, shown).map((r) => tile(r.cat, app.ctx.items, app)));
        count.textContent = rows.length + ' of ' + cats.length + ' categories';
        moreRow.classList.toggle('hidden', rows.length <= shown);
        if (!rows.length) grid.append(h('p', { class: 'muted' }, 'No category matches'));
      };

      const search = h('input', { type: 'search', class: 'map-search', placeholder: 'Search categories…', 'aria-label': 'Search categories', autocomplete: 'off',
        oninput: (e) => { query = e.target.value; shown = PAGE; draw(); } });
      const sortSel = h('select', { 'aria-label': 'Sort categories', onchange: (e) => { sort = e.target.value; shown = PAGE; draw(); } },
        SORTS.map(([v, label]) => h('option', { value: v, selected: v === sort }, label)));
      draw();
      root.append(h('div', { class: 'screen' },
        h('div', { class: 'topbar' }, h('h1', null, 'Category Map'),
          h('button', { class: 'btn', type: 'button', onclick: () => app.go('home') }, 'Back')),
        h('p', { class: 'muted small' }, 'Medal = share of items you know well (box 3+): Bronze 30% · Silver 60% · Gold 90%'),
        h('div', { class: 'map-toolbar' }, search, sortSel, count),
        grid, moreRow));
    },
  };
})(globalThis.LG = globalThis.LG || {});
