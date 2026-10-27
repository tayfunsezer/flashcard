(function (LG) {
  const { h } = LG.dom;
  const LIMIT = 50;
  let seq = 0;

  // Shared searchable list. cfg: { options, lang, multi, selected: string[], onpick(name) -> void, onclear?() }
  function build(cfg) {
    const id = 'cp' + (++seq);
    let selected = cfg.selected.slice();
    let query = '';
    let results = [];
    let active = 0;
    let first = true;

    const chips = h('div', { class: 'cp-chips' });
    const input = h('input', { type: 'search', class: 'cp-input', placeholder: 'Search categories…', 'aria-label': 'Search categories',
      role: 'combobox', 'aria-expanded': 'true', 'aria-controls': id + '-list', 'aria-autocomplete': 'list', autocomplete: 'off', spellcheck: 'false' });
    const list = h('ul', { class: 'cp-list', id: id + '-list', role: 'listbox', 'aria-multiselectable': cfg.multi ? 'true' : null });
    const note = h('div', { class: 'cp-note muted small' });
    const root = h('div', { class: 'catpicker' }, chips, input, list, note);

    function pick(name) {
      cfg.onpick(name, selected, (next) => { selected = next; });
      renderChips();
      renderList();
    }

    function renderChips() {
      LG.dom.clear(chips);
      if (!selected.length) {
        if (cfg.multi) chips.append(h('span', { class: 'muted small' }, 'All categories'));
        return;
      }
      for (const name of selected) {
        chips.append(h('span', { class: 'chip' }, h('span', { class: 'chip-text' }, name),
          cfg.multi ? h('button', { type: 'button', class: 'chip-x', 'aria-label': 'Remove ' + name, onclick: () => pick(name) }, '✕') : null));
      }
      if (cfg.multi) {
        chips.append(h('button', { type: 'button', class: 'cp-clear small', onclick: () => {
          selected = [];
          cfg.onclear();
          renderChips();
          renderList();
        } }, 'Clear'));
      }
    }

    function markActive() {
      let activeId = null;
      list.querySelectorAll('.cp-row').forEach((row, i) => {
        const on = i === active;
        row.classList.toggle('cp-active', on);
        if (on) { activeId = row.id; row.scrollIntoView({ block: 'nearest' }); }
      });
      if (activeId) input.setAttribute('aria-activedescendant', activeId);
      else input.removeAttribute('aria-activedescendant');
    }

    function renderList() {
      results = LG.words.searchCategories(cfg.options, query, cfg.lang, LIMIT);
      if (first) { first = false; if (!cfg.multi) active = Math.max(0, results.findIndex((o) => selected.includes(o.name))); }
      if (active >= results.length) active = Math.max(0, results.length - 1);
      LG.dom.clear(list);
      if (!results.length) list.append(h('li', { class: 'cp-empty muted small', role: 'presentation' }, 'No category matches'));
      results.forEach((o, i) => {
        const on = selected.includes(o.name);
        list.append(h('li', { class: 'cp-row' + (on ? ' cp-on' : ''), id: id + '-o' + i, role: 'option', 'aria-selected': String(on),
          onclick: () => { active = i; pick(o.name); input.focus(); } },
          cfg.multi ? h('span', { class: 'cp-box', 'aria-hidden': 'true' }, on ? '✓' : '') : h('span', { class: 'cp-tick', 'aria-hidden': 'true' }, on ? '✓' : ''),
          h('span', { class: 'cp-name' }, o.name),
          h('span', { class: 'cp-count muted small' }, '(' + o.count + ')')));
      });
      const total = query.trim() ? null : cfg.options.length;
      note.textContent = total !== null && total > results.length ? 'Showing ' + results.length + ' of ' + total + ' — type to narrow' : '';
      markActive();
    }

    input.addEventListener('input', () => { query = input.value; active = 0; renderList(); list.scrollTop = 0; });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!results.length) return;
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        markActive();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[active]) pick(results[active].name);
      } else if (e.key === 'Escape') {
        if (query) { e.preventDefault(); input.value = ''; query = ''; active = 0; renderList(); }
      }
    });

    renderChips();
    renderList();
    return root;
  }

  function multi({ options, selected, lang, onchange }) {
    return build({
      options, lang, multi: true, selected,
      onpick(name, sel, set) {
        const next = sel.includes(name) ? sel.filter((n) => n !== name) : sel.concat(name);
        set(next);
        onchange(next.slice());
      },
      onclear() { onchange([]); },
    });
  }

  function single({ options, value, lang, onchange }) {
    return build({
      options, lang, multi: false, selected: value ? [value] : [],
      onpick(name, sel, set) {
        set([name]);
        onchange(name);
      },
    });
  }

  LG.catpicker = { multi, single };
})(globalThis.LG = globalThis.LG || {});
