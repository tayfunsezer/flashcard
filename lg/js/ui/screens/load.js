(function (LG) {
  const { h } = LG.dom;
  const LANGS = [
    ['pl', 'Polish'], ['tr', 'Turkish'], ['en', 'English'], ['de', 'German'], ['fr', 'French'], ['es', 'Spanish'],
    ['it', 'Italian'], ['nl', 'Dutch'], ['pt', 'Portuguese'], ['ru', 'Russian'], ['ja', 'Japanese'], ['zh', 'Chinese'],
  ];
  const ENCODINGS = {
    'utf-8': 'UTF-8',
    xlsx: 'Excel workbook',
    'utf-16le': 'Read as UTF-16 (Excel Unicode Text)',
    'utf-16be': 'Read as UTF-16 (Excel Unicode Text)',
    'windows-1254': 'Read as Windows-1254 (Turkish)',
    'windows-1250': 'Read as Windows-1250 (Central European / Polish)',
  };

  function validCode(code) {
    try { return Intl.getCanonicalLocales(code).length === 1; } catch (e) { return false; }
  }

  // A language select with an "Other…" free-text BCP-47 code. picker.value is '' when invalid.
  function langPicker(label, initial, onchange) {
    const known = LANGS.some(([c]) => c === initial);
    const other = h('input', { type: 'text', placeholder: 'e.g. sv or pt-BR', 'aria-label': label + ' code', value: known ? '' : (initial || '') });
    const select = h('select', { 'aria-label': label },
      h('option', { value: '' }, 'Choose a language…'),
      LANGS.map(([c, n]) => h('option', { value: c }, n + ' (' + c + ')')),
      h('option', { value: 'other' }, 'Other…'));
    select.value = known ? initial : (initial ? 'other' : '');
    const err = h('span', { class: 'error-text hidden' }, 'Not a valid language code.');
    const picker = {
      get value() {
        if (select.value !== 'other') return select.value;
        const code = other.value.trim();
        return validCode(code) ? Intl.getCanonicalLocales(code)[0] : '';
      },
    };
    const sync = () => {
      const isOther = select.value === 'other';
      other.classList.toggle('hidden', !isOther);
      err.classList.toggle('hidden', !isOther || !other.value.trim() || picker.value !== '');
      if (onchange) onchange(picker.value);
    };
    select.addEventListener('change', sync);
    other.addEventListener('input', sync);
    other.classList.toggle('hidden', select.value !== 'other');
    picker.el = h('label', { class: 'field' }, h('span', null, label), h('div', { class: 'row' }, select, other), err);
    return picker;
  }

  function summaryList(entries) {
    return h('dl', { class: 'summary' }, entries.map(([k, v]) => [h('dt', null, k), h('dd', null, String(v))]));
  }

  function renderPick(root, error) {
    const app = LG.app;
    const zone = h('div', { class: 'dropzone' },
      h('p', null, 'Drop an .xlsx, .csv, .tsv or .json file here'),
      h('p', { class: 'muted small' }, 'Columns: 1 and 2 are the language you are learning and its translation (you choose which is which next), 3 Date, 4 Category (separate several with |, e.g. Food|Travel). A .json quiz file is a list of { question, options, correctIndex } entries.'),
      h('div', { class: 'btn-row', style: 'justify-content:center' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
          const f = await LG.dom.pickFile(LG.importer.ACCEPT);
          if (f) readAndShow(root, f);
        } }, 'Choose file'),
        h('button', { class: 'btn', type: 'button', onclick: () => {
          const res = LG.importer.rowsToDataset(LG.sampleRows, { learnColumn: 1 });
          renderLanguages(root, { res, rows: LG.sampleRows, fileName: 'Sample data', encoding: 'utf-8', langs: { langSource: 'en', langTarget: 'pl' } });
        } }, 'Try with sample data')));
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('over');
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (f) readAndShow(root, f);
    });
    LG.dom.clear(root).append(h('div', { class: 'screen' },
      h('div', { class: 'topbar' }, h('h1', null, 'Load a word list'),
        app.dataset ? h('button', { class: 'btn', type: 'button', onclick: () => app.go('home') }, 'Back') : null),
      error ? h('div', { class: 'banner banner-error', role: 'alert' }, h('span', null, 'Could not read the file: ' + error)) : null,
      zone));
  }

  async function readAndShow(root, file) {
    if (!/\.xlsx$/i.test(file.name) && !LG.importer.isTextTable(file.name) && !LG.importer.isJson(file.name)) return renderPick(root, file.name + ' is not an .xlsx, .csv, .tsv or .json file.');
    try {
      const { rows, json, encoding } = await LG.importer.readFile(file);
      if (json !== undefined) {
        const res = LG.importer.jsonToDataset(json, file.name);
        if (!res.items.length) return renderPick(root, 'no valid quiz entries were found.');
        return renderLanguages(root, { res, fileName: file.name, encoding });
      }
      const res = LG.importer.rowsToDataset(rows, { learnColumn: LG.app.state.settings.learnColumn });
      if (!res.items.length) return renderPick(root, 'no rows with both a Source and a Target were found.');
      renderLanguages(root, { res, rows, fileName: file.name, encoding });
    } catch (e) {
      renderPick(root, (e && e.message) || String(e));
    }
  }

  function clip(text, max = 60) {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  // Retitle a langPicker after creation (the column numbers in its label change with the mapping).
  function setPickerLabel(picker, label) {
    picker.el.querySelector(':scope > span').textContent = label;
    picker.el.querySelector('select').setAttribute('aria-label', label);
    picker.el.querySelector('input').setAttribute('aria-label', label + ' code');
  }

  // Language prompt plus import summary. With opts.res absent, only the language prompt (stored dataset).
  function renderLanguages(root, opts) {
    const app = LG.app;
    const cur = app.state.settings;
    const langs = opts.langs || {};
    const fresh = Boolean(opts.res);
    let res = opts.res;
    const isJson = fresh && opts.res.summary.format === 'json';
    let learnColumn = fresh && !isJson ? opts.res.summary.learnColumn : cur.learnColumn;
    const items = () => (fresh ? res.items : opts.dataset.items);
    const summaryBox = h('div');
    const previewBox = h('div');
    const hint = h('span', { class: 'muted small' }, 'Choose both languages');
    const startBtn = h('button', { class: 'btn btn-primary', type: 'button' }, fresh ? 'Start' : 'Continue');

    const labels = () => ({
      tgt: 'Language you\'re learning' + (fresh && !isJson ? ' (column ' + learnColumn + ')' : ''),
      src: 'Translation language' + (fresh && !isJson ? ' (column ' + (3 - learnColumn) + ')' : ''),
    });

    const update = () => {
      const lang = tgt.value;
      startBtn.disabled = !src.value || !lang;
      hint.classList.toggle('hidden', !startBtn.disabled);
      if (!fresh) return;
      const s = res.summary;
      const list = items();
      const sentences = list.filter((it) => LG.words.kindOf(it.target, lang || undefined) === 'sentence').length;
      LG.dom.clear(summaryBox).append(h('h2', null, 'Import summary'), summaryList([
        ['File', opts.fileName],
        ...(isJson ? [['Format', 'JSON quiz (' + (s.loaded + s.duplicates) + ' entries)']] : []),
        ['Items loaded', s.loaded],
        ['Sentences / terms', sentences + ' / ' + (list.length - sentences)],
        ['Categories', s.categories.length + ' (' + s.categories.join(', ') + ')'],
        ...(isJson ? (s.skippedInvalid ? [['Skipped (invalid entries)', s.skippedInvalid]] : []) : [
          ['Header row skipped', s.headerSkipped ? 'yes' : 'no'],
          ['Rows skipped (empty)', s.skippedEmpty],
        ]),
        ['Duplicates merged', s.duplicates],
        ...(isJson ? [] : [['Dates not understood', s.badDates]]),
        ['Encoding', ENCODINGS[opts.encoding] || opts.encoding],
      ]));
    };

    const renderPreview = () => {
      LG.dom.clear(previewBox).append(h('table', { class: 'preview' },
        h('thead', null, h('tr', null, h('th', null, 'Learning'), h('th', null, 'Translation'))),
        h('tbody', null, res.items.slice(0, 3).map((it) => h('tr', null, h('td', null, clip(it.target)), h('td', null, clip(it.source)))))));
    };

    const lab = labels();
    const src = langPicker(lab.src, langs.langSource || cur.langSource || '', update);
    const tgt = langPicker(lab.tgt, langs.langTarget || cur.langTarget || '', update);

    const setColumn = (n) => {
      learnColumn = n;
      res = LG.importer.rowsToDataset(opts.rows, { learnColumn: n });
      for (const b of mapping.querySelectorAll('button')) b.setAttribute('aria-pressed', String(Number(b.dataset.col) === n));
      const l = labels();
      setPickerLabel(src, l.src);
      setPickerLabel(tgt, l.tgt);
      renderPreview();
      update();
    };
    const mapBtn = (n) => h('button', { class: 'btn', type: 'button', 'data-col': String(n), 'aria-pressed': String(learnColumn === n),
      onclick: () => setColumn(n) }, 'Column ' + n);
    const mapping = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Language I\'m learning is in' }, mapBtn(1), mapBtn(2));

    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      const ds = fresh
        ? { items: items(), fileName: opts.fileName, importedAt: Date.now(), encoding: opts.encoding }
        : opts.dataset;
      try {
        if (fresh) await LG.storage.saveDataset(ds);
      } catch (e) {
        app.banner('The word list could not be stored; it will need loading again next time.', 'warn');
      }
      app.setSettings({ langSource: src.value, langTarget: tgt.value, learnColumn });
      app.setDataset(ds);
      app.go('home');
    });

    LG.dom.clear(root).append(h('div', { class: 'screen' },
      h('div', { class: 'topbar' }, h('h1', null, fresh ? 'Check the import' : 'Choose the languages'),
        fresh ? h('button', { class: 'btn', type: 'button', onclick: () => renderPick(root) }, 'Choose another file') : null),
      fresh ? h('div', { class: 'card stack' },
        h('h2', null, isJson ? 'Preview' : 'Which column is the language you\'re learning?'),
        isJson ? null : h('div', { class: 'row' }, h('span', null, 'Language I\'m learning is in'), mapping),
        previewBox) : null,
      h('div', { class: 'card' },
        h('h2', null, 'Languages'),
        h('p', { class: 'muted small' }, 'Used for lower-casing, word splitting and sorting.'),
        h('div', { class: 'row row-top' }, tgt.el, src.el)),
      fresh ? h('div', { class: 'card' }, summaryBox) : null,
      h('div', { class: 'btn-row' }, startBtn, hint)));
    if (fresh) renderPreview();
    update();
  }

  LG.screens.load = {
    LANGS,
    langPicker,
    render(root, params = {}) {
      if (params.dataset) renderLanguages(root, { dataset: params.dataset });
      else renderPick(root);
    },
  };
})(globalThis.LG = globalThis.LG || {});
