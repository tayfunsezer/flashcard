(function () {
  const G = 'https://docs.google.com/spreadsheets/d/e/K/pub?gid=0&single=true&output=tsv';
  const bytes = (s) => new TextEncoder().encode(s).buffer;
  // Fake fetch: records the calls and answers with the given status/content type/body.
  function fake(opts = {}) {
    const calls = [];
    const impl = async (url, init) => {
      calls.push([url, init]);
      if (opts.throws) throw opts.throws;
      return {
        ok: opts.status === undefined || opts.status < 400,
        status: opts.status || 200,
        headers: { get: (k) => (/content-type/i.test(k) ? opts.type || 'text/tab-separated-values; charset=utf-8' : null) },
        arrayBuffer: async () => bytes(opts.body === undefined ? 'a\tb\n' : opts.body),
      };
    };
    impl.calls = calls;
    return impl;
  }
  async function msg(promise) {
    try { await promise; return null; } catch (e) { return e.message; }
  }

  T.test('parseUrl trims and accepts http(s)', () => {
    T.eq(LG.remote.parseUrl('  https://x.test/a?b=1\n'), { ok: true, url: 'https://x.test/a?b=1' });
    T.ok(LG.remote.parseUrl('http://x.test/a.csv').ok);
  });
  T.test('parseUrl rejects empty and non-http text', () => {
    T.eq(LG.remote.parseUrl(''), { ok: false, error: 'Paste the link first.' });
    T.eq(LG.remote.parseUrl('   '), { ok: false, error: 'Paste the link first.' });
    for (const bad of ['javascript:alert(1)', 'ftp://x/y', 'hello']) {
      T.eq(LG.remote.parseUrl(bad), { ok: false, error: 'The link must start with https://' });
    }
  });
  T.test('fileNameFor', () => {
    T.eq(LG.remote.fileNameFor(G), 'Google Sheet.tsv');
    T.eq(LG.remote.fileNameFor('https://x.test/words.csv'), 'words.csv');
    T.eq(LG.remote.fileNameFor('https://x.test/pub?output=csv'), 'Word list.csv');
    T.eq(LG.remote.fileNameFor('https://x.test/data', 'application/json'), 'Word list.json');
    T.eq(LG.remote.fileNameFor('https://x.test/data'), 'Word list.csv');
    T.eq(LG.remote.fileNameFor('https://x.test/notes.txt'), 'Word list.csv');
  });
  T.test('fetchFile returns a file-like object and asks for fresh data', async () => {
    const f = fake();
    const file = await LG.remote.fetchFile(G, { fetchImpl: f });
    T.eq(file.name, 'Google Sheet.tsv');
    T.eq(new TextDecoder().decode(await file.arrayBuffer()), 'a\tb\n');
    T.eq(f.calls, [[G, { cache: 'no-store' }]]);
    T.eq((await LG.remote.fetchFile(G, { fetchImpl: fake(), fileName: 'mine.tsv' })).name, 'mine.tsv');
  });
  T.test('fetchFile readable errors', async () => {
    T.ok((await msg(LG.remote.fetchFile(G, { fetchImpl: fake({ status: 404 }) }))).includes('404'));
    T.eq(await msg(LG.remote.fetchFile(G, { fetchImpl: fake({ type: 'text/html; charset=utf-8' }) })),
      'The link returned a web page, not a table. Use the published TSV or CSV link.');
    T.ok((await msg(LG.remote.fetchFile(G, { fetchImpl: fake({ throws: new TypeError('Failed to fetch') }) }))).startsWith('Could not download.'));
    T.ok((await msg(LG.remote.fetchFile(G, { fetchImpl: fake({ body: '' }) }))).includes('empty'));
  });
  T.test('fetchFile explains the file:// limit when the download fails there', async () => {
    const m = await msg(LG.remote.fetchFile(G, { fetchImpl: fake({ throws: new TypeError('Failed to fetch') }), protocol: 'file:' }));
    T.ok(m.startsWith('Could not download.') && m.includes('opened from a file') && m.includes('web address'));
    const web = await msg(LG.remote.fetchFile(G, { fetchImpl: fake({ throws: new TypeError('x') }), protocol: 'https:' }));
    T.ok(!web.includes('opened from a file'));
  });
  T.test('fetchFile never calls fetch for an invalid link', async () => {
    const f = fake();
    T.eq(await msg(LG.remote.fetchFile('hello', { fetchImpl: f })), 'The link must start with https://');
    T.eq(f.calls.length, 0);
  });
  T.test('a fetched TSV goes through readFile and rowsToDataset', async () => {
    const f = fake({ body: 'POL\tTUR\tDate\tGROUP\nkot\tcat\t13-12-2025\tNoun\n' });
    const file = await LG.remote.fetchFile(G, { fetchImpl: f });
    const { rows } = await LG.importer.readFile(file);
    const res = LG.importer.rowsToDataset(rows, { learnColumn: 1 });
    T.eq([res.items.length, res.items[0].target, res.items[0].categories], [1, 'kot', ['Noun']]);
  });
})();
