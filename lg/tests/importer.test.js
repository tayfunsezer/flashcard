(function () {
  const im = LG.importer;
  const H = ['Source', 'Target', 'Date', 'Category'];
  T.test('header row skipped when col 3 is not a date', () => {
    const r = im.rowsToDataset([H, ['hello', 'merhaba', '13-12-2025', 'Greetings']]);
    T.eq(r.summary.headerSkipped, true);
    T.eq(r.items.length, 1);
    T.eq(r.items[0].date, '2025-12-13');
    T.eq(r.items[0].categories, ['Greetings']);
  });
  T.test('first row kept when col 3 is a date', () => {
    const r = im.rowsToDataset([['a', 'b', '01-01-2025', 'X'], ['c', 'd', '02-01-2025', 'X']]);
    T.eq(r.summary.headerSkipped, false);
    T.eq(r.items.length, 2);
  });
  T.test('first row kept when col 3 is empty', () => {
    const r = im.rowsToDataset([['a', 'b', '', 'X'], ['c', 'd', '', 'X']]);
    T.eq(r.summary.headerSkipped, false);
    T.eq(r.items.length, 2);
  });
  T.test('cleaning: empty, duplicates, numbers, whitespace, uncategorized, extra cols', () => {
    const r = im.rowsToDataset([H,
      ['  hello   world ', 'merhaba  dünya', '', '', 'extra'],
      ['hello world', 'merhaba dünya', '', ''],
      ['x', '', '', ''],
      [42, 'kırk iki', 'yesterday', 'Numbers']], { learnColumn: 2 });
    T.eq(r.items.length, 2);
    T.eq(r.items[0].source, 'hello world');
    T.eq(r.items[0].categories, ['Uncategorized']);
    T.eq(r.items[1].source, '42');
    T.eq(r.items[1].date, null);
    T.eq(r.summary.duplicates, 1);
    T.eq(r.summary.skippedEmpty, 1);
    T.eq(r.summary.badDates, 1);
  });
  T.test('categories merge case-insensitively', () => {
    const r = im.rowsToDataset([H, ['a', 'b', '', 'Food'], ['c', 'd', '', 'food ']]);
    T.eq(r.items.map(i => i.categories), [['Food'], ['Food']]);
    T.eq(r.summary.categories, ['Food']);
  });
  T.test('splitCategories', () => {
    T.eq(LG.importer.splitCategories('Food|Travel'), ['Food', 'Travel']);
    T.eq(LG.importer.splitCategories(' Food | | Travel |'), ['Food', 'Travel']);
    T.eq(LG.importer.splitCategories(''), ['Uncategorized']);
    T.eq(LG.importer.splitCategories('|'), ['Uncategorized']);
  });
  T.test('rowsToDataset: multi-category, case merge, dedupe, duplicate rows union', () => {
    const r = LG.importer.rowsToDataset([['Source', 'Target', 'Date', 'Category'],
      ['bread', 'chleb', '', 'Food|Home'],
      ['apple', 'jabłko', '', 'food|FOOD|Fruit'],
      ['bread', 'chleb', '', 'Shopping']]);
    T.eq(r.items.map(i => i.categories), [['Food', 'Home', 'Shopping'], ['Food', 'Fruit']]);
    T.eq(r.summary.categories, ['Food', 'Home', 'Fruit', 'Shopping']);
    T.eq(r.summary.duplicates, 1);
    T.ok(!('category' in r.items[0]));
  });
  T.test('rowsToDataset learnColumn 1 (default): col 1 is target', () => {
    const r = LG.importer.rowsToDataset([['chleb', 'bread', '13-12-2025', 'Food']]);
    T.eq([r.items[0].target, r.items[0].source, r.summary.learnColumn], ['chleb', 'bread', 1]);
  });
  T.test('rowsToDataset learnColumn 2: col 2 is target; ids are by role', () => {
    const a = LG.importer.rowsToDataset([['bread', 'chleb', '', 'Food']], { learnColumn: 2 });
    const b = LG.importer.rowsToDataset([['chleb', 'bread', '', 'Food']], { learnColumn: 1 });
    T.eq([a.items[0].target, a.items[0].source], ['chleb', 'bread']);
    T.eq(a.items[0].id, b.items[0].id);
  });
  T.test('migrateItems converts old shape only', () => {
    const out = LG.importer.migrateItems([{ id: 'a', category: 'A|B' }, { id: 'b', categories: ['C'] }]);
    T.eq(out, [{ id: 'a', categories: ['A', 'B'] }, { id: 'b', categories: ['C'] }]);
  });
  T.test('duplicate row with blank category adds no Uncategorized', () => {
    const r = LG.importer.rowsToDataset([['bread', 'chleb', '', 'Food'], ['bread', 'chleb', '', '']]);
    T.eq(r.items.map(i => i.categories), [['Food']]);
    T.eq(r.summary.categories, ['Food']);
    T.eq(r.summary.duplicates, 1);
  });
  T.test('migrateItems defaults missing or invalid categories', () => {
    const out = LG.importer.migrateItems([{ id: 'a' }, { id: 'b', categories: [] }, { id: 'c', categories: 'X' }, { id: 'd', category: 5 }]);
    T.eq(out.map(i => i.categories), [['Uncategorized'], ['Uncategorized'], ['Uncategorized'], ['Uncategorized']]);
  });
  T.test('itemId is stable and NFC-insensitive', () => {
    T.eq(im.itemId('café', 'kafe'), im.itemId('café', 'kafe'));
    T.ok(im.itemId('a', 'b') !== im.itemId('a', 'c'));
  });
  T.test('sniffDelimiter ignores quoted commas', () => {
    T.eq(im.sniffDelimiter('a;b;c\n1;2;3'), ';');
    T.eq(im.sniffDelimiter('"x, y, z";b\n'), ';');
    T.eq(im.sniffDelimiter('a,b\n'), ',');
    T.eq(im.sniffDelimiter('a\tb\n'), '\t');
  });
  T.test('CSV keeps dates as text and parses semicolons', () => {
    const rows = im.sheetRowsFromCsvText('cat;kedi;13-12-2025;Animals\n');
    T.eq(rows[0], ['cat', 'kedi', '13-12-2025', 'Animals']);
    T.eq(im.rowsToDataset(rows).items[0].date, '2025-12-13');
  });
  T.test('decodeCsvBytes: utf-8, BOM, windows-1254, windows-1250', () => {
    const utf = new Uint8Array([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode('kız')]);
    T.eq(im.decodeCsvBytes(utf), { text: 'kız', encoding: 'utf-8' });
    // "kız;ağaç" in windows-1254
    T.eq(im.decodeCsvBytes(new Uint8Array([0x6B, 0xFD, 0x7A, 0x3B, 0x61, 0xF0, 0x61, 0xE7])),
      { text: 'kız;ağaç', encoding: 'windows-1254' });
    // "łódź" in windows-1250
    T.eq(im.decodeCsvBytes(new Uint8Array([0xB3, 0xF3, 0x64, 0x9F])),
      { text: 'łódź', encoding: 'windows-1250' });
  });
  T.test('xlsx: serial date cell becomes ISO date', () => {
    const ws = XLSX.utils.aoa_to_sheet([['cat', 'kedi', 45000, 'Animals']]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'S');
    const rows = im.sheetRowsFromXlsx(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    T.eq(im.rowsToDataset(rows).items[0].date, '2023-03-15');
  });
  T.test('isTextTable routes csv/tsv/txt', () => {
    T.ok(im.isTextTable('words.tsv'));
    T.ok(im.isTextTable('WORDS.TXT'));
    T.ok(im.isTextTable('a.csv'));
    T.ok(!im.isTextTable('a.xlsx'));
  });
  T.test('TSV text parses by position', () => {
    const rows = im.sheetRowsFromCsvText('book\tksiążka\t13-12-2025\tHome\nturtle\tżółw\t14-12-2025\tAnimals\n');
    const r = im.rowsToDataset(rows, { learnColumn: 2 });
    T.eq(r.items.map(i => [i.source, i.target, i.date, i.categories]),
      [['book', 'książka', '2025-12-13', ['Home']], ['turtle', 'żółw', '2025-12-14', ['Animals']]]);
  });
  T.test('windows-1250 TSV decodes Polish', () => {
    // "żółw\tł" in windows-1250
    const r = im.decodeCsvBytes(new Uint8Array([0xBF, 0xF3, 0xB3, 0x77, 0x09, 0xB3]));
    T.eq(r, { text: 'żółw\tł', encoding: 'windows-1250' });
  });
  function utf16(str, le) {
    const out = [le ? 0xFF : 0xFE, le ? 0xFE : 0xFF];
    for (const u of str) { const c = u.charCodeAt(0); out.push(...(le ? [c & 255, c >> 8] : [c >> 8, c & 255])); }
    return new Uint8Array(out);
  }
  const TAB = String.fromCharCode(9);
  const CRLF = String.fromCharCode(13, 10);
  T.test('UTF-16LE with BOM decodes (Excel Unicode Text)', () => {
    const r = im.decodeCsvBytes(utf16('żółw' + TAB + 'turtle', true));
    T.eq(r, { text: 'żółw' + TAB + 'turtle', encoding: 'utf-16le' });
  });
  T.test('UTF-16BE with BOM decodes', () => {
    T.eq(im.decodeCsvBytes(utf16('żółw' + TAB + 'turtle', false)), { text: 'żółw' + TAB + 'turtle', encoding: 'utf-16be' });
  });
  T.test('UTF-16LE text file round-trips to a dataset', () => {
    const src = ['Source' + TAB + 'Target' + TAB + 'Date' + TAB + 'Category', 'turtle' + TAB + 'żółw', 'cat' + TAB + 'kot', ''].join(CRLF);
    const { text } = im.decodeCsvBytes(utf16(src, true));
    const r = im.rowsToDataset(im.sheetRowsFromCsvText(text), { learnColumn: 2 });
    T.eq(r.items.map((i) => [i.source, i.target]), [['turtle', 'żółw'], ['cat', 'kot']]);
    T.eq(r.summary.headerSkipped, true);
  });
  T.test('jsonToDataset maps quiz entries', () => {
    const text = JSON.stringify([
      { question: 'it does not bother me', options: ['Czy przeszkadzam?', 'To mi nie przeszkadza', 'przesadzony', ''], correctIndex: 1 },
      { question: 'abartilmis', options: ['przesadzony', 'nadmiernie'], correctIndex: 0 },
    ]);
    const r = LG.importer.jsonToDataset(text, 'special-attention-9.json');
    T.eq(r.items.map(i => [i.source, i.target, i.date, i.categories, i.options]), [
      ['it does not bother me', 'To mi nie przeszkadza', null, ['special-attention-9'], ['Czy przeszkadzam?', 'przesadzony']],
      ['abartilmis', 'przesadzony', null, ['special-attention-9'], ['nadmiernie']],
    ]);
    T.eq(r.items[0].id, LG.importer.itemId('it does not bother me', 'To mi nie przeszkadza'));
    T.eq(r.summary.format, 'json');
    T.eq(r.summary.loaded, 2);
  });
  T.test('jsonToDataset skips invalid entries and accepts {items:[...]}', () => {
    const text = '﻿' + JSON.stringify({ items: [
      { question: 'a', options: ['x', 'y'], correctIndex: 5 },
      { question: '', options: ['x'], correctIndex: 0 },
      { question: 'b', options: 'x', correctIndex: 0 },
      'nope',
      { question: 'c', options: ['z'], correctIndex: 0 },
    ] });
    const r = LG.importer.jsonToDataset(text);
    T.eq(r.items.map(i => i.target), ['z']);
    T.eq(r.summary.skippedInvalid, 4);
    T.eq(r.items[0].categories, ['Uncategorized']);
    T.ok(!('options' in r.items[0]));
  });
  T.test('jsonToDataset merges duplicates and drops answer look-alikes from options', () => {
    const text = JSON.stringify([
      { question: 'q', options: ['Kot', 'kot', 'pies'], correctIndex: 0 },
      { question: 'q', options: ['Kot', 'ryba'], correctIndex: 0 },
    ]);
    const r = LG.importer.jsonToDataset(text, 'f.json');
    T.eq(r.items.length, 1);
    T.eq(r.items[0].options, ['pies']);
    T.eq(r.summary.duplicates, 1);
  });
  T.test('jsonToDataset errors', () => {
    T.throws(() => LG.importer.jsonToDataset('{bad'));
    T.throws(() => LG.importer.jsonToDataset('{"a":1}'));
  });
  T.test('isJson and ACCEPT', () => {
    T.ok(LG.importer.isJson('x.JSON'));
    T.ok(!LG.importer.isJson('x.csv'));
    T.ok(LG.importer.ACCEPT.includes('.json'));
  });
  T.test('migrateItems keeps options', () => {
    const it = { id: 'a', source: 's', target: 't', date: null, categories: ['C'], options: ['x'] };
    T.eq(LG.importer.migrateItems([it])[0].options, ['x']);
    T.eq(LG.importer.migrateItems([{ id: 'a', category: 'C', options: ['x'] }])[0].options, ['x']);
  });
})();
