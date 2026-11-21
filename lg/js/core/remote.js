(function (LG) {
  const NOT_HTTP = 'The link must start with https://';
  const HTML_PAGE = 'The link returned a web page, not a table. Use the published TSV or CSV link.';
  const NETWORK = 'Could not download. Check your connection, and that the link is published to the web (the host must allow browser downloads).';
  const FILE_PAGE = ' The app is opened from a file here, and Google blocks downloads from those; open it from its web address instead.';
  const EXT_BY_PATH = { csv: 'csv', tsv: 'tsv', txt: 'csv', json: 'json', xlsx: 'xlsx' };

  // Trim, then accept http(s) links only.
  function parseUrl(text) {
    const t = String(text == null ? '' : text).trim();
    if (!t) return { ok: false, error: 'Paste the link first.' };
    let u;
    try { u = new URL(t); } catch (e) { return { ok: false, error: NOT_HTTP }; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: NOT_HTTP };
    return { ok: true, url: t };
  }

  function extFromType(type) {
    const t = String(type || '').toLowerCase();
    if (t.includes('tab-separated')) return 'tsv';
    if (t.includes('csv')) return 'csv';
    if (t.includes('json')) return 'json';
    if (t.includes('spreadsheetml')) return 'xlsx';
    return null;
  }

  // A name whose extension tells readFile how to parse the bytes.
  function fileNameFor(url, contentType) {
    let u;
    try { u = new URL(url); } catch (e) { return 'Word list.csv'; }
    const last = decodeURIComponent(u.pathname.split('/').pop() || '');
    const pathExt = (/\.([a-z0-9]+)$/i.exec(last) || [])[1];
    const output = (u.searchParams.get('output') || '').toLowerCase();
    const ext = (output === 'tsv' || output === 'csv' ? output : null)
      || (pathExt && EXT_BY_PATH[pathExt.toLowerCase()])
      || extFromType(contentType) || 'csv';
    if (u.hostname === 'docs.google.com') return 'Google Sheet.' + ext;
    if (pathExt && last.toLowerCase().endsWith('.' + ext)) return last;
    return 'Word list.' + ext;
  }

  // Download a published table; resolves to a file-like { name, arrayBuffer } that LG.importer.readFile accepts.
  async function fetchFile(url, opts = {}) {
    const parsed = parseUrl(url);
    if (!parsed.ok) throw new Error(parsed.error);
    const fetchImpl = opts.fetchImpl || globalThis.fetch;
    let res;
    try {
      res = await fetchImpl(parsed.url, { cache: 'no-store' });
    } catch (e) {
      const protocol = opts.protocol || (globalThis.location && globalThis.location.protocol);
      throw new Error(NETWORK + (protocol === 'file:' ? FILE_PAGE : ''));
    }
    if (!res.ok) throw new Error('Could not download: the server answered ' + res.status + '.');
    const type = res.headers.get('content-type') || '';
    if (/text\/html/i.test(type)) throw new Error(HTML_PAGE);
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) throw new Error('The link returned an empty file.');
    return { name: opts.fileName || fileNameFor(parsed.url, type), arrayBuffer: async () => buf };
  }

  LG.remote = { parseUrl, fileNameFor, fetchFile };
})(globalThis.LG = globalThis.LG || {});
