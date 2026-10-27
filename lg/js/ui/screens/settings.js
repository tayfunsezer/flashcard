(function (LG) {
  const { h } = LG.dom;

  function themeCard() {
    const app = LG.app;
    const cur = app.state.settings.theme;
    const opt = (value, label) => h('label', { class: 'choice' },
      h('input', { type: 'radio', name: 'theme', value, checked: cur === value,
        onchange: () => app.setSettings({ theme: value }) }), label);
    return h('div', { class: 'card' },
      h('h2', null, 'Theme'),
      h('div', { class: 'row' }, opt('system', 'System'), opt('light', 'Light'), opt('dark', 'Dark')));
  }

  function languagesCard() {
    const app = LG.app;
    const s = app.state.settings;
    const status = h('span', { class: 'muted small', role: 'status' });
    const changed = () => {
      status.textContent = '';
      if (!src.value || !tgt.value) return;
      app.setSettings({ langSource: src.value, langTarget: tgt.value });
      status.textContent = 'Saved.';
    };
    const src = LG.screens.load.langPicker('Translation language', s.langSource, changed);
    const tgt = LG.screens.load.langPicker("Language you're learning", s.langTarget, changed);
    return h('div', { class: 'card' },
      h('h2', null, 'Languages'),
      h('div', { class: 'row row-top' }, tgt.el, src.el),
      h('p', { class: 'muted small' }, 'Language being learned comes from column ' + s.learnColumn + ' of your file (change it when you load a file).'),
      h('p', { style: 'margin-top:8px' }, status));
  }

  function progressCard() {
    const app = LG.app;
    const resetInput = h('input', { type: 'text', placeholder: 'Type RESET', 'aria-label': 'Type RESET to confirm' });
    const resetBtn = h('button', { class: 'btn btn-danger', type: 'button', disabled: true, onclick: () => {
      if (resetInput.value !== 'RESET') return;
      const fresh = LG.state.defaultState();
      app.setState(Object.assign(fresh, { settings: app.state.settings, lastExport: app.state.lastExport }));
      app.banner('Progress reset.', 'info');
      app.refresh();
    } }, 'Reset progress');
    resetInput.addEventListener('input', () => { resetBtn.disabled = resetInput.value !== 'RESET'; });
    return h('div', { class: 'card stack' },
      h('h2', null, 'Progress'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onclick: () => { app.exportNow(); app.refresh(); } }, 'Export progress'),
        h('button', { class: 'btn', type: 'button', onclick: async () => { if (await app.importFromFile()) app.refresh(); } }, 'Import progress'),
        h('span', { class: 'muted small' }, 'Last exported: ' + app.lastExportText())),
      h('p', { class: 'muted small' }, 'Import replaces your current progress. The word list itself stays in your spreadsheet.'),
      h('div', null,
        h('h3', null, 'Reset progress'),
        h('p', { class: 'muted small' }, 'Clears boxes, XP, streak and study set. Settings are kept. This cannot be undone.'),
        h('div', { class: 'btn-row' }, resetInput, resetBtn)));
  }

  LG.screens.settings = {
    render(root) {
      const app = LG.app;
      root.append(
        h('div', { class: 'topbar' }, h('h1', null, 'Settings'),
          h('button', { class: 'btn', type: 'button', onclick: () => app.go('home') }, 'Back')),
        themeCard(), languagesCard(), progressCard());
    },
  };
})(globalThis.LG = globalThis.LG || {});
