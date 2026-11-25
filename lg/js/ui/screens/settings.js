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

  // Voice for the language being learned: Automatic (best available) or one picked from this device's voices.
  function voiceCard() {
    const app = LG.app;
    const lang = app.state.settings.langTarget;
    if (!lang || !LG.speech.available()) return null;
    const card = h('div', { class: 'card stack' });
    const name = (() => { try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(lang) || lang; } catch (e) { return lang; } })();
    const draw = () => {
      const list = LG.voice.forLang(LG.speech.voices(), lang);
      const chosen = app.state.settings.voices[lang] || '';
      const children = [h('h2', null, 'Voice')];
      if (!list.length) {
        children.push(h('p', { class: 'muted small' }, 'No ' + name + ' voice found on this device.'));
      } else {
        const best = list[0];
        const missing = chosen && !list.some((v) => v.name === chosen);
        const select = h('select', { 'aria-label': 'Voice for ' + name, onchange: (e) => {
          const next = Object.assign({}, app.state.settings.voices);
          if (e.target.value) next[lang] = e.target.value; else delete next[lang];
          app.setSettings({ voices: next });
          draw();
        } },
          h('option', { value: '', selected: !chosen || missing }, 'Automatic (best available)'),
          list.map((v) => h('option', { value: v.name, selected: v.name === chosen }, LG.voice.label(v))));
        const sample = (app.ctx && app.ctx.items.length && app.ctx.items[0].target) || name;
        children.push(
          h('div', { class: 'row' }, select,
            h('button', { class: 'btn', type: 'button', onclick: () => LG.speech.speak(sample, lang) }, 'Test voice')),
          h('p', { class: 'muted small' }, missing ? 'Saved voice not found, using ' + LG.voice.label(best) + '.'
            : chosen ? 'Using ' + chosen + '.' : 'Automatic uses ' + LG.voice.label(best) + '.'),
          h('label', { class: 'choice' },
            h('input', { type: 'checkbox', checked: app.state.settings.speakMatch,
              onchange: (e) => app.setSettings({ speakMatch: e.target.checked }) }), 'Read ' + name + ' tiles aloud in Pair Match'),
          h('p', { class: 'muted small' }, 'Better voices: System Settings, Accessibility, Spoken Content, System Voice, Manage Voices. Restart the browser after downloading.'));
      }
      LG.dom.clear(card).append(...children);
    };
    let seen = false;
    const off = LG.speech.onVoices(() => {
      if (card.isConnected) seen = true;
      else if (seen) { off(); return; }
      draw();
    });
    draw();
    return card;
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
        ...[themeCard(), languagesCard(), voiceCard(), progressCard()].filter(Boolean));
    },
  };
})(globalThis.LG = globalThis.LG || {});
