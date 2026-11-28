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

  // Download a published table and continue like a picked file. The button shows progress while it runs.
  async function downloadLink(root, url, btn) {
    const parsed = LG.remote.parseUrl(url);
    if (!parsed.ok) return renderPick(root, parsed.error, '');
    btn.disabled = true;
    btn.textContent = 'Downloading…';
    try {
      const file = await LG.remote.fetchFile(parsed.url);
      LG.storage.saveLink(parsed.url);
      await readAndShow(root, file, null, parsed.url);
    } catch (e) {
      renderPick(root, (e && e.message) || String(e), '');
    }
  }

  // The link row: paste a published table link, download it, continue like a picked file.
  function linkRow(root) {
    const app = LG.app;
    const input = h('input', { type: 'url', class: 'link-input', inputmode: 'url', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
      autocomplete: 'off', placeholder: 'https://docs.google.com/spreadsheets/d/e/…/pub?output=tsv', value: LG.storage.loadLink() || (app.dataset && app.dataset.sourceUrl) || '' });
    const btn = h('button', { class: 'btn btn-primary', type: 'button' }, 'Download');
    const go = () => downloadLink(root, input.value, btn);
    btn.addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    return h('div', { class: 'card stack' },
      h('label', { class: 'field' }, h('span', null, 'Or paste a link to a published table (.tsv, .csv)'), h('div', { class: 'link-row' }, input, btn)),
      h('p', { class: 'muted small' }, 'The host must allow downloads from a web page; a Google Sheets "Publish to the web" link does. Refresh (↻) downloads it again. The link is saved in this browser only.'));
  }

  // Pick a day and a type; the file is read from the local repeated-words folder (its own folder choice, separate from Export a day's).
  function repeatCard(root) {
    const app = LG.app;
    const canPick = typeof globalThis.showDirectoryPicker === 'function';
    const date = h('input', { type: 'date', class: 'repeat-date', 'aria-label': 'Day', value: LG.storage.loadRepeatDate() || LG.dates.todayISO() });
    const type = h('select', { 'aria-label': 'File type' },
      h('option', { value: 'marked' }, 'Marked words'), h('option', { value: 'special' }, 'Special attention'));
    const btn = h('button', { class: 'btn btn-primary', type: 'button' }, 'Load');
    const note = h('span', { class: 'muted small' }, canPick ? 'No folder chosen yet: you pick it on the first load.' : 'Needs Chrome or Edge.');
    let dir = null;
    const sync = () => { btn.disabled = !canPick || !date.value; };
    date.addEventListener('input', () => { if (date.value) LG.storage.saveRepeatDate(date.value); sync(); });
    sync();
    const shown = (d) => { note.textContent = 'Folder: ' + d.name; };
    LG.storage.loadReadDirHandle().then((d) => { if (d) { dir = d; shown(d); } }).catch(() => {});
    const msg = (e) => (e && (e.message || e.name)) || String(e);

    const choose = async () => {
      try {
        dir = await globalThis.showDirectoryPicker({ mode: 'read' });
        try { await LG.storage.saveReadDirHandle(dir); } catch (e) { /* chosen again next time */ }
        shown(dir);
        return true;
      } catch (e) {
        if (!e || e.name !== 'AbortError') app.banner('The folder could not be opened: ' + msg(e), 'error');
        return false;
      }
    };
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true; // one load at a time: a double click must not start a second one
      try {
        await load();
      } finally {
        sync();
      }
    });
    const load = async () => {
      if (!dir && !(await choose())) return;
      try {
        if (dir.requestPermission && await dir.requestPermission({ mode: 'read' }) !== 'granted') {
          return app.banner('Folder access was not allowed.', 'error');
        }
        const found = await LG.dayexport.findInRepo(dir, date.value, type.value);
        if (!found) {
          const month = LG.dayexport.relPath(date.value)[0];
          const hint = (await LG.dayexport.monthFolderExists(dir, date.value)) ? '' : ' There is no ' + month + ' folder in "' + dir.name + '": is that the right folder? Use Change folder.';
          return app.banner('No file for ' + LG.dates.formatDate(date.value) + ' in ' + month + '.' + hint, 'error');
        }
        await readAndShow(root, found.file, null);
      } catch (e) {
        app.banner('Could not read the folder (' + msg(e) + '). Use Change folder.', 'error');
      }
    };
    const change = canPick ? h('button', { class: 'btn btn-small', type: 'button', onclick: choose }, 'Change folder') : null;
    return h('div', { class: 'card stack repeat-card' },
      h('strong', null, 'Repeat words'),
      h('div', { class: 'link-row' }, date, type, btn),
      h('div', { class: 'row' }, note, change));
  }

  // The quick-load area above the dropzone: the remembered sheet (when a link is saved) and the repeat-words day.
  // linkEl is the paste-link card: hidden while a link is saved (Change link reveals it), so there is one button per situation.
  function quickRow(root, linkEl) {
    const link = LG.storage.loadLink();
    const cards = [];
    if (link) {
      const btn = h('button', { class: 'btn btn-primary load-sheet', type: 'button' }, 'Load my sheet');
      btn.addEventListener('click', () => downloadLink(root, link, btn));
      const change = h('button', { class: 'btn btn-small change-link', type: 'button', onclick: () => {
        const hide = !linkEl.classList.contains('hidden');
        linkEl.classList.toggle('hidden', hide);
        change.textContent = hide ? 'Change link' : 'Hide link';
      } }, 'Change link');
      linkEl.classList.add('hidden');
      cards.push(h('div', { class: 'card stack' }, h('div', { class: 'btn-row' }, btn, change)));
    }
    cards.push(repeatCard(root));
    return h('div', { class: 'stack quick-load' }, cards);
  }

  function renderPick(root, error, prefix = 'Could not read the file: ') {
    const app = LG.app;
    const zone = h('div', { class: 'dropzone' },
      h('p', null, 'Drop an .xlsx, .csv, .tsv or .json file here'),
      h('p', { class: 'muted small' }, 'Columns: 1 and 2 are the language you are learning and its translation (you choose which is which next), 3 Date, 4 Category (separate several with |, e.g. Food|Travel). A .json quiz file is a list of { question, options, correctIndex } entries.'),
      h('div', { class: 'btn-row', style: 'justify-content:center' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
          // The plain file input: the File System Access picker can stay silent on file:// pages in Edge.
          const file = await LG.dom.pickFile(LG.importer.ACCEPT);
          if (file) readAndShow(root, file, null);
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
      const dt = e.dataTransfer;
      const f = dt && dt.files[0];
      if (!f) return;
      // Ask for the handle now: the data transfer items are emptied once this handler returns.
      const item = dt.items && dt.items[0];
      const handlePromise = item && typeof item.getAsFileSystemHandle === 'function'
        ? item.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null);
      LG.dom.withTimeout(handlePromise, 1500, null).then((handle) => readAndShow(root, f, handle && handle.kind === 'file' ? handle : null));
    });
    const linkEl = linkRow(root);
    LG.dom.clear(root).append(h('div', { class: 'screen' },
      h('div', { class: 'topbar' }, h('h1', null, 'Load a word list'),
        app.dataset ? h('button', { class: 'btn', type: 'button', onclick: () => app.go('home') }, 'Back') : null),
      error ? h('div', { class: 'banner banner-error', role: 'alert' }, h('span', null, prefix + error)) : null,
      quickRow(root, linkEl), zone, linkEl));
  }

  async function readAndShow(root, file, handle = null, sourceUrl = null) {
    if (!/\.xlsx$/i.test(file.name) && !LG.importer.isTextTable(file.name) && !LG.importer.isJson(file.name)) return renderPick(root, file.name + ' is not an .xlsx, .csv, .tsv or .json file.');
    try {
      const { rows, json, encoding } = await LG.importer.readFile(file);
      if (json !== undefined) {
        const res = LG.importer.jsonToDataset(json, file.name);
        if (!res.items.length) return renderPick(root, 'no valid quiz entries were found.');
        return renderLanguages(root, { res, fileName: file.name, encoding, handle, sourceUrl });
      }
      const res = LG.importer.rowsToDataset(rows, { learnColumn: LG.app.state.settings.learnColumn });
      if (!res.items.length) return renderPick(root, 'no rows with both a Source and a Target were found.');
      renderLanguages(root, { res, rows, fileName: file.name, encoding, handle, sourceUrl });
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
        ? { items: items(), fileName: opts.fileName, importedAt: Date.now(), encoding: opts.encoding, learnColumn, ...(opts.sourceUrl ? { sourceUrl: opts.sourceUrl } : {}) }
        : opts.dataset;
      try {
        if (fresh) await LG.storage.saveDataset(ds);
      } catch (e) {
        app.banner('The word list could not be stored; it will need loading again next time.', 'warn');
      }
      if (fresh) {
        // The sample has no file behind it; a file picked without a handle clears any older one.
        try { await LG.storage.saveHandle(opts.fileName === 'Sample data' ? null : opts.handle || null); } catch (e) { /* Refresh file re-picks */ }
      }
      app.setSettings({ langSource: src.value, langTarget: tgt.value, learnColumn });
      if (fresh) app.resetFilters(); // a new file starts unfiltered
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
    importFile: readAndShow,
    render(root, params = {}) {
      if (params.file) readAndShow(root, params.file, params.handle || null, params.sourceUrl || null);
      else if (params.dataset) renderLanguages(root, { dataset: params.dataset });
      else renderPick(root);
    },
  };
})(globalThis.LG = globalThis.LG || {});
