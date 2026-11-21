(function (LG) {
  const { h } = LG.dom;

  LG.screens.marked = {
    render(root) {
      const app = LG.app;
      const chosen = new Set();

      const draw = () => {
        const items = LG.marked.markedItems(app.ctx.items, app.state.progress);
        // Keep only selections that are still marked (a list that shrank must not carry stale ids).
        for (const id of [...chosen]) if (!items.some((it) => it.id === id)) chosen.delete(id);
        const unmark = h('button', { class: 'btn btn-primary unmark-selected', type: 'button', disabled: chosen.size === 0, onclick: () => {
          const k = chosen.size;
          app.setState(LG.play.clearStars(app.state, [...chosen]));
          chosen.clear();
          draw();
          app.banner('Unmarked ' + k + (k === 1 ? ' word.' : ' words.'), 'info');
        } }, 'Unmark selected (' + chosen.size + ')');
        const rows = items.map((it) => h('label', { class: 'mm-row' },
          h('input', { type: 'checkbox', checked: chosen.has(it.id), onchange: (e) => {
            if (e.target.checked) chosen.add(it.id); else chosen.delete(it.id);
            unmark.disabled = chosen.size === 0;
            unmark.textContent = 'Unmark selected (' + chosen.size + ')';
          } }),
          h('span', { class: 'mm-text' }, it.target, h('span', { class: 'muted small' }, it.source))));
        const setAll = (on) => () => {
          chosen.clear();
          if (on) items.forEach((it) => chosen.add(it.id));
          draw();
        };
        LG.dom.clear(root).append(h('div', { class: 'screen' },
          h('div', { class: 'topbar' }, h('h1', null, 'Marked words (' + items.length + ')'),
            h('button', { class: 'btn', type: 'button', onclick: () => app.go('home') }, 'Back')),
          items.length
            ? h('div', { class: 'card' },
              h('div', { class: 'btn-row', style: 'margin-bottom:8px' },
                h('button', { class: 'btn btn-small', type: 'button', onclick: setAll(true) }, 'Select all'),
                h('button', { class: 'btn btn-small', type: 'button', onclick: setAll(false) }, 'Select none'),
                unmark),
              rows)
            : h('div', { class: 'card' }, h('p', { class: 'muted' }, 'No marked words.'))));
      };
      draw();
    },
  };
})(globalThis.LG = globalThis.LG || {});
