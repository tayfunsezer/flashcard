(function (LG) {
  // The offline hand-off with Claude: the app writes a request file, the learner gives it to Claude (Claude Code or
  // any assistant), Claude writes a response file, the app loads it. Formats: docs/ask-claude-format.md.
  const REQUEST_FORMAT = 'lg-ask-claude-request';
  const RESPONSE_FORMAT = 'lg-ask-claude-response';
  const VERSION = 1;
  const MAX_TEXT = 200;
  const MAX_FILE = 1000000;
  const MAX_ITEMS = 60;

  const COMMON = 'You are helping a learner of {learning} (translations in {translation}). '
    + 'The "items" array lists the learner\'s words: "source" is the translation, "target" is the {learning} text being learned. '
    + 'Answer ONLY with one JSON file in this shape (see "respondWith.shape"): '
    + '{ "format": "' + RESPONSE_FORMAT + '", "version": ' + VERSION + ', "requestId": <copy from this request>, "task": <copy from this request>, '
    + '"results": { "<item id>": <result> } }. Copy every item id exactly. Leave out items that need no result. '
    + 'Every text is plain text, at most ' + MAX_TEXT + ' characters, no markup. Do not add other fields. ';

  const TASKS = {
    examples: {
      label: 'Example sentences',
      blurb: 'One short example sentence per word, with its translation.',
      instructions: 'TASK "examples": for each item write ONE short, natural example sentence in {learning} that uses the target text '
        + '(change its form only where grammar needs it), at A2 level, using no vocabulary harder than the word itself, and the same sentence '
        + 'translated into {translation}. Result: { "sentence": "<{learning} sentence>", "translation": "<{translation} sentence>" }. '
        + 'Skip an item whose target already is a full sentence.',
      shape: { sentence: '<example sentence in the learning language>', translation: '<the same sentence in the translation language>' },
      skipSentences: true,
    },
    aspect: {
      label: 'Aspect pairs',
      blurb: 'For verbs: the imperfective and perfective forms, in one clean format.',
      instructions: 'TASK "aspect": for each item that is a verb (the notation in the cells may be messy: "&", brackets, impf., IMP, dokonane, imperfective ...), '
        + 'give the infinitive of its imperfective form and of its perfective form in {learning}. '
        + 'Result: { "impf": "<imperfective infinitive>", "pf": "<perfective infinitive>" }; give only the form(s) you are sure of, at least one. '
        + 'Leave out items that are not verbs.',
      shape: { impf: '<imperfective infinitive>', pf: '<perfective infinitive>' },
      skipSentences: false,
    },
  };
  const TASK_IDS = Object.keys(TASKS);

  function isPlain(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }

  // Plain text only: control characters become spaces, runs of spaces collapse, NFC.
  function clean(v) {
    if (typeof v !== 'string') return null;
    return v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().normalize('NFC');
  }

  // One result for a task: { ok, value } or { ok: false, reason }. Unknown fields are dropped.
  function validateResult(task, v) {
    if (!isPlain(v)) return { ok: false, reason: 'not an object' };
    const out = {};
    const fields = task === 'examples' ? ['sentence', 'translation'] : ['impf', 'pf'];
    for (const f of fields) {
      if (v[f] === undefined || v[f] === null) continue;
      const c = clean(v[f]);
      if (c === null) return { ok: false, reason: f + ' is not text' };
      if (c.length > MAX_TEXT) return { ok: false, reason: f + ' is longer than ' + MAX_TEXT + ' characters' };
      if (c) out[f] = c;
    }
    if (task === 'examples') {
      if (!out.sentence || !out.translation) return { ok: false, reason: 'needs both sentence and translation' };
    } else if (!out.impf && !out.pf) return { ok: false, reason: 'needs impf or pf' };
    return { ok: true, value: out };
  }

  function emptyNotes() { return { version: 1, byId: {}, lastRequest: null }; }

  // Whatever storage returns, as a safe notes object.
  function normaliseNotes(raw) {
    if (!isPlain(raw) || !isPlain(raw.byId)) return emptyNotes();
    const byId = {};
    for (const [id, entry] of Object.entries(raw.byId)) {
      if (!isPlain(entry)) continue;
      const kept = {};
      for (const task of TASK_IDS) {
        if (entry[task] === undefined) continue;
        const r = validateResult(task, entry[task]);
        if (r.ok) kept[task] = r.value;
      }
      if (Object.keys(kept).length) byId[id] = kept;
    }
    const lr = raw.lastRequest;
    const lastRequest = isPlain(lr) && typeof lr.requestId === 'string' && TASKS[lr.task] && Array.isArray(lr.ids)
      ? { requestId: lr.requestId, task: lr.task, ids: lr.ids.filter((x) => typeof x === 'string') } : null;
    return { version: 1, byId, lastRequest };
  }

  function countNotes(notes) { return Object.keys(notes.byId).length; }

  // The words a request would carry: { items, total (matching the task), done (already answered), cap (truncated) }.
  function selectItems(items, task, notes, { lang, skipDone = true, cap = MAX_ITEMS } = {}) {
    const def = TASKS[task];
    if (!def) throw new Error('Unknown task: ' + task);
    const candidates = items.filter((it) => !def.skipSentences || LG.words.kindOf(it.target, lang) !== 'sentence');
    const answered = (it) => !!(notes.byId[it.id] && notes.byId[it.id][task]);
    const done = candidates.filter(answered).length;
    let list = skipDone ? candidates.filter((it) => !answered(it)) : candidates;
    const truncated = list.length > cap;
    if (truncated) list = list.slice(0, cap);
    return { items: list, total: candidates.length, done, cap: truncated };
  }

  function requestFileName(task, dateIso) { return 'lg-request-' + task + '-' + dateIso + '.json'; }
  function responseFileName(task, dateIso) { return 'lg-response-' + task + '-' + dateIso + '.json'; }

  function fill(text, languages) {
    return text.replace(/\{learning\}/g, languages.learning || 'the learned language').replace(/\{translation\}/g, languages.translation || 'the translation language');
  }

  function buildRequest({ items, task, languages, nowMs, dateIso }) {
    const def = TASKS[task];
    if (!def) throw new Error('Unknown task: ' + task);
    const langs = languages || {};
    const hash = LG.rng.cyrb53(String(nowMs) + '|' + task + '|' + items.map((it) => it.id).join(',')).toString(36).padStart(6, '0').slice(-6);
    const requestId = 'r-' + dateIso.replace(/-/g, '') + '-' + hash;
    return {
      format: REQUEST_FORMAT,
      version: VERSION,
      requestId,
      createdAt: new Date(nowMs).toISOString(),
      task,
      languages: { learning: langs.learning || '', translation: langs.translation || '' },
      instructions: fill(COMMON + def.instructions, langs),
      respondWith: {
        fileName: responseFileName(task, dateIso),
        shape: { format: RESPONSE_FORMAT, version: VERSION, requestId, task, results: { '<item id>': def.shape } },
      },
      items: items.map((it) => ({ id: it.id, source: it.source, target: it.target, categories: it.categories || [] })),
    };
  }

  // The one sentence the learner gives to Claude.
  function handoffSentence(requestName, responseName) {
    return 'Read the file ' + requestName + ' and follow the instructions inside it. Write your answer as JSON to a new file named '
      + responseName + ' in the same folder, and tell me when it is written.';
  }

  // Check a response file's text. `ids`: Set/Map of the item ids in the loaded word list; `lastRequest`: from the notes.
  function parseResponse(text, { ids, lastRequest } = {}) {
    if (typeof text !== 'string' || text.length > MAX_FILE) return { ok: false, error: 'The file is too large (over 1 MB) to be a response.' };
    let data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'This file is not valid JSON.' }; }
    if (!isPlain(data) || data.format !== RESPONSE_FORMAT) return { ok: false, error: 'This is not an Ask Claude response file (format "' + RESPONSE_FORMAT + '" expected).' };
    if (data.version !== VERSION) return { ok: false, error: 'Unsupported response version ' + data.version + ' (this app reads version ' + VERSION + ').' };
    if (!TASKS[data.task]) return { ok: false, error: 'Unknown task "' + data.task + '".' };
    if (!isPlain(data.results)) return { ok: false, error: 'The file has no "results" object.' };
    const results = {};
    const rejected = [];
    let unknown = 0;
    for (const [id, value] of Object.entries(data.results)) {
      if (!ids || !ids.has(id)) { unknown++; continue; }
      const r = validateResult(data.task, value);
      if (r.ok) results[id] = r.value; else rejected.push({ id, reason: r.reason });
    }
    const warnings = [];
    if (lastRequest && typeof data.requestId === 'string' && lastRequest.requestId !== data.requestId) {
      warnings.push('This answer belongs to request ' + data.requestId + ', not your latest request (' + lastRequest.requestId + ').');
    }
    return { ok: true, task: data.task, requestId: typeof data.requestId === 'string' ? data.requestId : '', results, rejected, unknown, warnings, note: clean(data.note) || '' };
  }

  function mergeNotes(notes, task, results) {
    const byId = Object.assign({}, notes.byId);
    for (const [id, value] of Object.entries(results)) byId[id] = Object.assign({}, byId[id], { [task]: value });
    return Object.assign({}, notes, { byId });
  }

  function withLastRequest(notes, request) {
    return Object.assign({}, notes, { lastRequest: { requestId: request.requestId, task: request.task, ids: request.items.map((it) => it.id) } });
  }

  // Refresh file: notes follow a corrected row to its new id (an existing entry for the new id wins).
  function carryNotes(notes, pairs) {
    if (!pairs.length) return notes;
    const byId = Object.assign({}, notes.byId);
    for (const p of pairs) {
      const e = byId[p.from];
      if (!e) continue;
      delete byId[p.from];
      if (!(p.to in byId)) byId[p.to] = e;
    }
    return Object.assign({}, notes, { byId });
  }

  LG.claude = {
    REQUEST_FORMAT, RESPONSE_FORMAT, VERSION, MAX_TEXT, MAX_ITEMS, TASKS, TASK_IDS,
    emptyNotes, normaliseNotes, countNotes, selectItems, requestFileName, responseFileName, buildRequest, handoffSentence,
    parseResponse, mergeNotes, withLastRequest, carryNotes,
  };
})(globalThis.LG = globalThis.LG || {});
