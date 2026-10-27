(function (LG) {
  const { normalizeCell, lower } = LG.text;
  const TR_RE = /[ğĞşŞıİ]/g;
  const PL_RE = /[ąĄęĘłŁńŃśŚźŹżŻ]/g;

  function itemId(source, target) {
    return 'i' + LG.rng.cyrb53(normalizeCell(source) + '\u0001' + normalizeCell(target)).toString(36);
  }

  function stripBom(s) {
    return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
  }

  function decodeCsvBytes(bytes) {
    // Excel "Unicode Text (*.txt)" is UTF-16LE with a BOM.
    const utf16 = bytes[0] === 0xFF && bytes[1] === 0xFE ? 'utf-16le' : bytes[0] === 0xFE && bytes[1] === 0xFF ? 'utf-16be' : null;
    if (utf16) return { text: stripBom(new TextDecoder(utf16).decode(bytes)), encoding: utf16 };
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return { text: stripBom(text), encoding: 'utf-8' };
    } catch (e) {
      const t54 = new TextDecoder('windows-1254').decode(bytes);
      const t50 = new TextDecoder('windows-1250').decode(bytes);
      const h54 = (t54.match(TR_RE) || []).length;
      const h50 = (t50.match(PL_RE) || []).length;
      return h50 > h54
        ? { text: stripBom(t50), encoding: 'windows-1250' }
        : { text: stripBom(t54), encoding: 'windows-1254' };
    }
  }

  function sniffDelimiter(text) {
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let inQuotes = false;
    for (const ch of text) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (!inQuotes && (ch === '\n' || ch === '\r')) break;
      if (!inQuotes && ch in counts) counts[ch]++;
    }
    let best = ',';
    for (const d of [';', '\t']) if (counts[d] > counts[best]) best = d;
    return best;
  }

  function firstSheetRows(wb) {
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  }

  function sheetRowsFromCsvText(text) {
    return firstSheetRows(XLSX.read(text, { type: 'string', raw: true, FS: sniffDelimiter(text) }));
  }

  function sheetRowsFromXlsx(buf) {
    return firstSheetRows(XLSX.read(buf, { type: 'array' }));
  }

  const ACCEPT = '.xlsx,.csv,.tsv,.txt,.json';
  function isJson(fileName) { return /\.json$/i.test(fileName); }
  function isTextTable(fileName) { return /\.(csv|tsv|txt)$/i.test(fileName); }

  async function readFile(file) {
    if (isJson(file.name)) {
      const { text, encoding } = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
      return { json: text, encoding };
    }
    if (isTextTable(file.name)) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { text, encoding } = decodeCsvBytes(bytes);
      return { rows: sheetRowsFromCsvText(text), encoding };
    }
    return { rows: sheetRowsFromXlsx(await file.arrayBuffer()), encoding: 'xlsx' };
  }

  function isEmptyCell(v) {
    return v instanceof Date ? false : normalizeCell(v) === '';
  }

  // "Food|Travel" -> ['Food', 'Travel']; empty -> ['Uncategorized'].
  function splitCategories(cell) {
    const parts = normalizeCell(cell).split('|').map((p) => p.trim()).filter(Boolean);
    return parts.length ? parts : ['Uncategorized'];
  }

  // Stored datasets of the old shape (string `category`) become `categories` arrays.
  function migrateItems(items) {
    return items.map((it) => {
      if (Array.isArray(it.categories) && it.categories.length) return it;
      const { category, ...rest } = it;
      return { ...rest, categories: splitCategories(typeof category === 'string' ? category : '') };
    });
  }

  // opts.learnColumn: 1 (default) = column 1 is the language being learned (target); 2 = column 2 is.
  function rowsToDataset(rows, opts = {}) {
    const learnColumn = opts.learnColumn === 2 ? 2 : 1;
    const summary = { learnColumn, loaded: 0, headerSkipped: false, skippedEmpty: 0, duplicates: 0, badDates: 0, categories: [] };
    const items = [];
    const seen = new Set();
    const byId = new Map();
    const catByKey = new Map();
    let start = 0;
    if (rows.length > 0) {
      const r0 = rows[0] || [];
      if (!isEmptyCell(r0[2]) && LG.dates.parseDate(r0[2]) === null) {
        summary.headerSkipped = true;
        start = 1;
      }
    }
    for (let i = start; i < rows.length; i++) {
      const row = rows[i] || [];
      const c1 = normalizeCell(row[0]);
      const c2 = normalizeCell(row[1]);
      const target = learnColumn === 1 ? c1 : c2;
      const source = learnColumn === 1 ? c2 : c1;
      if (!source || !target) { summary.skippedEmpty++; continue; }
      let date = null;
      if (!isEmptyCell(row[2])) {
        date = LG.dates.parseDate(row[2]);
        if (date === null) summary.badDates++;
      }
      const id = itemId(source, target);
      if (seen.has(id) && isEmptyCell(row[3])) { summary.duplicates++; continue; } // blank category adds nothing
      const categories = [];
      for (const part of splitCategories(row[3])) {
        const key = lower(part, undefined);
        let name = part;
        if (catByKey.has(key)) name = catByKey.get(key);
        else { catByKey.set(key, part); summary.categories.push(part); }
        if (!categories.includes(name)) categories.push(name);
      }
      if (seen.has(id)) {
        summary.duplicates++;
        const first = byId.get(id);
        for (const c of categories) if (!first.categories.includes(c)) first.categories.push(c);
        continue;
      }
      const item = { id, source, target, date, categories };
      seen.add(id);
      byId.set(id, item);
      items.push(item);
    }
    summary.loaded = items.length;
    return { items, summary };
  }

  function jsonEntries(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      const arrays = Object.values(data).filter(Array.isArray);
      if (Object.keys(data).length === 1 && arrays.length === 1) return arrays[0];
    }
    throw new Error('This JSON file is not a list of quiz entries.');
  }

  // Quiz entries { question, options, correctIndex }: question is the translation, options[correctIndex] the answer.
  function jsonToDataset(text, fileName) {
    let data;
    try { data = JSON.parse(stripBom(text)); } catch (e) { throw new Error('This file is not valid JSON.'); }
    const entries = jsonEntries(data);
    const base = fileName ? String(fileName).split(/[\\/]/).pop().replace(/\.[^.]*$/, '').trim() : '';
    const cat = base || 'Uncategorized';
    const summary = { learnColumn: 1, format: 'json', loaded: 0, headerSkipped: false, skippedEmpty: 0, skippedInvalid: 0, duplicates: 0, badDates: 0, categories: [cat] };
    const items = [];
    const byId = new Map();
    for (const e of entries) {
      const ok = e && typeof e === 'object' && !Array.isArray(e) && Array.isArray(e.options) && Number.isInteger(e.correctIndex)
        && e.correctIndex >= 0 && e.correctIndex < e.options.length;
      const source = ok ? normalizeCell(e.question) : '';
      const target = ok ? normalizeCell(e.options[e.correctIndex]) : '';
      if (!source || !target) { summary.skippedInvalid++; continue; }
      const id = itemId(source, target);
      if (byId.has(id)) { summary.duplicates++; continue; }
      const key = lower(target, undefined);
      const others = [];
      const seenOpt = new Set([key]);
      e.options.forEach((o, i) => {
        if (i === e.correctIndex) return;
        const n = normalizeCell(o);
        const k = lower(n, undefined);
        if (!n || seenOpt.has(k)) return;
        seenOpt.add(k);
        others.push(n);
      });
      const item = { id, source, target, date: null, categories: [cat] };
      if (others.length) item.options = others;
      byId.set(id, item);
      items.push(item);
    }
    summary.loaded = items.length;
    return { items, summary };
  }

  LG.importer = { jsonToDataset, isJson, itemId, decodeCsvBytes, sniffDelimiter, sheetRowsFromCsvText, sheetRowsFromXlsx, readFile, isTextTable, ACCEPT, rowsToDataset, splitCategories, migrateItems };
})(globalThis.LG = globalThis.LG || {});
