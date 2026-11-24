(function (LG) {
  // The offline hand-off with Claude: the app writes a request file, the learner gives it to Claude (Claude Code or
  // any assistant), Claude writes an answer file, the app checks it. Each use case has its own formats:
  // docs/ask-claude-format.md.
  const VERSION = 1;
  const MAX_TEXT = 200;
  const MAX_QUESTION = 300;
  const MAX_FILE = 1000000;
  const WARN_OVER = 50;

  const examplesInstructions = () => 'You are helping a learner of {learning} (translations in {translation}). '
    + 'The "items" array lists the learner\'s words: "source" is the translation, "target" is the {learning} text being learned. '
    + 'Answer ONLY with one JSON file in this shape (see "respondWith.shape"): '
    + '{ "format": "lg-examples-response", "version": ' + VERSION + ', "requestId": <copy from this request>, "task": "examples", '
    + '"results": { "<item id>": { "sentence": "...", "translation": "..." } } }. Copy every item id exactly. Leave out items that need no result. '
    + 'Every text is plain text, at most ' + MAX_TEXT + ' characters, no markup. Do not add other fields. '
    + 'TASK "examples": for each item write ONE short, natural example sentence in {learning} that uses the target text '
    + '(change its form only where grammar needs it), at A2 level, using no vocabulary harder than the word itself, and the same sentence '
    + 'translated into {translation}. Skip an item whose target already is a full sentence.';

  const endingsInstructions = (singleWords) => 'You are helping a learner of {learning} (translations in {translation}). '
    + 'The "items" array lists the learner\'s words: "source" is the translation, "target" is the {learning} text being learned. '
    + 'TASK "endings": make a multiple-choice quiz about {learning} case endings from these items. '
    + 'For each item find the word whose case ending matters (for example a noun after a preposition such as do, na, w, z, or after a verb that takes a case) '
    + 'and write ONE question: the sentence with that word replaced by ____ (four underscores), exactly 4 options, and the index of the correct option. '
    + 'The options are the correct form and three wrong forms of the SAME word in other cases: real, plausible forms, all different. '
    + (singleWords
      ? 'If the item is a single word or a short phrase, write a short sentence of your own (A2 level) that uses it in a case-governed position, and base the question on that sentence. '
      : 'Use only items that are already sentences; skip single words and short phrases. ')
    + 'Skip an item that has no case point. Vary the position of the correct option. '
    + 'Answer ONLY with a JSON array (see "respondWith.shape"), nothing else: '
    + '[ { "question": "Idę do ____ .", "options": ["basen", "basenu", "basenie", "basenem"], "correctIndex": 1 } ]. '
    + 'This is the quiz format the learner\'s apps load. Each text is plain text with no markup; do not add other fields.';

  const TASKS = {
    examples: {
      kind: 'notes',
      label: 'Example sentences',
      blurb: 'One short example sentence per word, with its translation. Shown under the answer on a flashcard.',
      skipSentences: true,
      shape: { format: 'lg-examples-response', version: VERSION, requestId: '<copy>', task: 'examples',
        results: { '<item id>': { sentence: '<example sentence in the learning language>', translation: '<the same sentence in the translation language>' } } },
    },
    endings: {
      kind: 'quiz',
      label: 'Case endings quiz',
      blurb: 'A multiple-choice quiz: the sentence with a blank and four forms of one word, one correct. Claude picks the word.',
      skipSentences: false,
      shape: [{ question: 'Idę do ____ .', options: ['basen', 'basenu', 'basenie', 'basenem'], correctIndex: 1 }],
    },
  };
  const TASK_IDS = Object.keys(TASKS);

  const requestFormat = (task) => 'lg-' + task + '-request';
  const responseFormat = (task) => 'lg-' + task + '-response';

  function isPlain(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }

  // Plain text only: control characters become spaces, runs of spaces collapse, NFC.
  function clean(v) {
    if (typeof v !== 'string') return null;
    return v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().normalize('NFC');
  }

  // One `examples` result: { ok, value } or { ok: false, reason }. Unknown fields are dropped.
  function validateExample(v) {
    if (!isPlain(v)) return { ok: false, reason: 'not an object' };
    const out = {};
    for (const f of ['sentence', 'translation']) {
      const c = clean(v[f]);
      if (c === null) return { ok: false, reason: f + ' is missing or not text' };
      if (c.length > MAX_TEXT) return { ok: false, reason: f + ' is longer than ' + MAX_TEXT + ' characters' };
      if (!c) return { ok: false, reason: f + ' is empty' };
      out[f] = c;
    }
    return { ok: true, value: out };
  }

  function emptyNotes() { return { version: 1, byId: {}, lastRequest: null }; }

  const noteTasks = () => TASK_IDS.filter((t) => TASKS[t].kind === 'notes');

  // Whatever storage returns, as a safe notes object (entries of tasks that no longer exist are dropped).
  function normaliseNotes(raw) {
    if (!isPlain(raw) || !isPlain(raw.byId)) return emptyNotes();
    const byId = {};
    for (const [id, entry] of Object.entries(raw.byId)) {
      if (!isPlain(entry)) continue;
      const kept = {};
      if (entry.examples !== undefined) {
        const r = validateExample(entry.examples);
        if (r.ok) kept.examples = r.value;
      }
      if (Object.keys(kept).length) byId[id] = kept;
    }
    const lr = raw.lastRequest;
    const lastRequest = isPlain(lr) && typeof lr.requestId === 'string' && TASKS[lr.task] && Array.isArray(lr.ids)
      ? { requestId: lr.requestId, task: lr.task, ids: lr.ids.filter((x) => typeof x === 'string') } : null;
    return { version: 1, byId, lastRequest };
  }

  function countNotes(notes) { return Object.keys(notes.byId).length; }

  function overLimit(n) { return n > WARN_OVER; }

  // The words a request would carry: { items, total (matching the task), done (already answered) }. No cap.
  function selectItems(items, task, notes, { lang, skipDone = true, singleWords = true } = {}) {
    const def = TASKS[task];
    if (!def) throw new Error('Unknown task: ' + task);
    const isSentence = (it) => LG.words.kindOf(it.target, lang) === 'sentence';
    let candidates = items;
    if (def.skipSentences) candidates = items.filter((it) => !isSentence(it));
    if (task === 'endings' && !singleWords) candidates = items.filter(isSentence);
    if (def.kind !== 'notes') return { items: candidates, total: candidates.length, done: 0 };
    const answered = (it) => !!(notes.byId[it.id] && notes.byId[it.id][task]);
    const done = candidates.filter(answered).length;
    return { items: skipDone ? candidates.filter((it) => !answered(it)) : candidates, total: candidates.length, done };
  }

  const requestFileName = (task, dateIso) => 'lg-request-' + task + '-' + dateIso + '.json';
  const quizFileName = (dateIso) => 'lg-endings-quiz-' + dateIso + '.json';
  const responseFileName = (task, dateIso) => (task === 'endings' ? quizFileName(dateIso) : 'lg-response-' + task + '-' + dateIso + '.json');

  function fill(text, languages) {
    return text.replace(/\{learning\}/g, languages.learning || 'the learned language').replace(/\{translation\}/g, languages.translation || 'the translation language');
  }

  function buildRequest({ items, task, languages, nowMs, dateIso, singleWords = true }) {
    const def = TASKS[task];
    if (!def) throw new Error('Unknown task: ' + task);
    const langs = languages || {};
    const hash = LG.rng.cyrb53(String(nowMs) + '|' + task + '|' + items.map((it) => it.id).join(',')).toString(36).padStart(6, '0').slice(-6);
    const requestId = 'r-' + dateIso.replace(/-/g, '') + '-' + hash;
    const shape = task === 'examples' ? Object.assign({}, def.shape, { requestId }) : def.shape;
    const req = {
      format: requestFormat(task),
      version: VERSION,
      requestId,
      createdAt: new Date(nowMs).toISOString(),
      task,
      languages: { learning: langs.learning || '', translation: langs.translation || '' },
      instructions: fill(task === 'examples' ? examplesInstructions() : endingsInstructions(singleWords), langs),
      respondWith: { fileName: responseFileName(task, dateIso), shape },
      items: items.map((it) => ({ id: it.id, source: it.source, target: it.target, categories: it.categories || [] })),
    };
    if (task === 'endings') req.options = { singleWords: !!singleWords };
    return req;
  }

  // The one sentence the learner gives to Claude.
  function handoffSentence(requestName, responseName) {
    return 'Read the file ' + requestName + ' and follow the instructions inside it. Write your answer as JSON to a new file named '
      + responseName + ' in the same folder, and tell me when it is written.';
  }

  // Check an `examples` response file's text. `ids`: Set/Map of the item ids in the loaded word list; `lastRequest`: from the notes.
  function parseResponse(text, { ids, lastRequest } = {}) {
    if (typeof text !== 'string' || text.length > MAX_FILE) return { ok: false, error: 'The file is too large (over 1 MB) to be a response.' };
    let data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'This file is not valid JSON.' }; }
    if (!isPlain(data) || data.format !== responseFormat('examples')) return { ok: false, error: 'This is not an example-sentences response file (format "' + responseFormat('examples') + '" expected).' };
    if (data.version !== VERSION) return { ok: false, error: 'Unsupported response version ' + data.version + ' (this app reads version ' + VERSION + ').' };
    if (data.task !== 'examples') return { ok: false, error: 'Unknown task "' + data.task + '".' };
    if (!isPlain(data.results)) return { ok: false, error: 'The file has no "results" object.' };
    const results = {};
    const rejected = [];
    let unknown = 0;
    for (const [id, value] of Object.entries(data.results)) {
      if (!ids || !ids.has(id)) { unknown++; continue; }
      const r = validateExample(value);
      if (r.ok) results[id] = r.value; else rejected.push({ id, reason: r.reason });
    }
    const warnings = [];
    if (lastRequest && typeof data.requestId === 'string' && lastRequest.requestId !== data.requestId) {
      warnings.push('This answer belongs to request ' + data.requestId + ', not your latest request (' + lastRequest.requestId + ').');
    }
    return { ok: true, task: 'examples', requestId: typeof data.requestId === 'string' ? data.requestId : '', results, rejected, unknown, warnings, note: clean(data.note) || '' };
  }

  // Check a quiz file (the format the Load screen and the fc app read): an array of { question, options (4), correctIndex }
  // or an object with one array property. Returns the cleaned questions and the rejected ones with a reason.
  function parseQuiz(text) {
    if (typeof text !== 'string' || text.length > MAX_FILE) return { ok: false, error: 'The file is too large (over 1 MB) to be a quiz.' };
    let data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'This file is not valid JSON.' }; }
    let list = Array.isArray(data) ? data : null;
    if (!list && isPlain(data)) {
      const arrays = Object.values(data).filter(Array.isArray);
      if (arrays.length === 1) list = arrays[0];
    }
    if (!list) return { ok: false, error: 'This is not a quiz file: a JSON array of { question, options, correctIndex } was expected.' };
    if (!list.length) return { ok: false, error: 'The quiz has no questions.' };
    const questions = [];
    const rejected = [];
    list.forEach((v, index) => {
      const bad = (reason) => rejected.push({ index, reason, question: isPlain(v) && typeof v.question === 'string' ? v.question.slice(0, 60) : '' });
      if (!isPlain(v)) return bad('not an object');
      const question = clean(v.question);
      if (!question) return bad('the question is empty');
      if (question.length > MAX_QUESTION) return bad('the question is longer than ' + MAX_QUESTION + ' characters');
      if (!Array.isArray(v.options) || v.options.length !== 4) return bad('needs exactly 4 options');
      const options = v.options.map(clean);
      if (options.some((o) => !o)) return bad('an option is empty or not text');
      if (options.some((o) => o.length > MAX_TEXT)) return bad('an option is longer than ' + MAX_TEXT + ' characters');
      if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return bad('the 4 options must be different');
      if (!Number.isInteger(v.correctIndex) || v.correctIndex < 0 || v.correctIndex > 3) return bad('correctIndex must be a whole number from 0 to 3');
      questions.push({ question, options, correctIndex: v.correctIndex });
    });
    return { ok: true, questions, rejected };
  }

  // One `examples` result as a single line of text (preview table).
  function formatResult(task, value) {
    if (!value || task !== 'examples') return '';
    return value.sentence + ' — ' + value.translation;
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
    VERSION, MAX_TEXT, WARN_OVER, TASKS, TASK_IDS, requestFormat, responseFormat, noteTasks,
    emptyNotes, normaliseNotes, countNotes, overLimit, selectItems, requestFileName, responseFileName, quizFileName, buildRequest,
    handoffSentence, parseResponse, parseQuiz, formatResult, mergeNotes, withLastRequest, carryNotes,
  };
})(globalThis.LG = globalThis.LG || {});
