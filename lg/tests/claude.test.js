(function () {
  const C = LG.claude;
  const it = (id, source, target, categories) => ({ id, source, target, date: null, categories: categories || [] });
  const items = [
    it('a', 'house', 'dom', ['x']), it('b', 'to do', 'robić', ['Verb']),
    it('c', 'I am going to the pool', 'Idę do basenu dziś rano', ['Expressions']), it('d', 'cat', 'kot', ['x']),
  ];
  const ids = new Set(items.map((x) => x.id));
  const GOOD = (extra) => JSON.stringify(Object.assign({ format: 'lg-examples-response', version: 1, requestId: 'r-1', task: 'examples', results: {} }, extra));
  const Q = (extra) => Object.assign({ question: 'Idę do ____ .', options: ['basen', 'basenu', 'basenie', 'basenem'], correctIndex: 1 }, extra);

  T.test('each use case has its own format names', () => {
    T.eq([C.requestFormat('examples'), C.responseFormat('examples')], ['lg-examples-request', 'lg-examples-response']);
    T.eq(C.requestFormat('endings'), 'lg-endings-request');
    T.eq(C.TASK_IDS, ['examples', 'endings']);
    T.eq(C.TASKS.aspect, undefined);
  });
  T.test('selectItems examples: skips sentences and answered items, counts them, has no cap', () => {
    const notes = { version: 1, byId: { d: { examples: { sentence: 'Kot śpi.', translation: 'The cat sleeps.' } } }, lastRequest: null };
    const r = C.selectItems(items, 'examples', notes, { lang: 'pl', skipDone: true });
    T.eq(r.items.map((x) => x.id), ['a', 'b']);
    T.eq([r.done, r.total], [1, 3]);
    T.eq(C.selectItems(items, 'examples', notes, { lang: 'pl', skipDone: false }).items.map((x) => x.id), ['a', 'b', 'd']);
    const many = Array.from({ length: 120 }, (_, i) => it('m' + i, 's' + i, 'w' + i));
    T.eq(C.selectItems(many, 'examples', C.emptyNotes(), { lang: 'pl', skipDone: true }).items.length, 120);
  });
  T.test('selectItems endings: every word by default; single words off keeps only sentence rows', () => {
    T.eq(C.selectItems(items, 'endings', C.emptyNotes(), { lang: 'pl' }).items.length, 4);
    T.eq(C.selectItems(items, 'endings', C.emptyNotes(), { lang: 'pl', singleWords: false }).items.map((x) => x.id), ['c']);
  });
  T.test('WARN_OVER is 50 and overLimit says when to warn', () => {
    T.eq(C.WARN_OVER, 50);
    T.eq([C.overLimit(50), C.overLimit(51)], [false, true]);
  });
  T.test('buildRequest examples: format, task, ids, instructions and respondWith', () => {
    const q = C.buildRequest({ items: [items[0]], task: 'examples', languages: { learning: 'pl', translation: 'en' }, nowMs: Date.UTC(2026, 10, 25, 1, 0, 0), dateIso: '2026-11-25' });
    T.eq([q.format, q.version, q.task, q.createdAt], ['lg-examples-request', 1, 'examples', '2026-11-25T01:00:00.000Z']);
    T.ok(/^r-20261125-[0-9a-z]{6}$/.test(q.requestId), q.requestId);
    T.eq(q.items, [{ id: 'a', source: 'house', target: 'dom', categories: ['x'] }]);
    T.ok(q.instructions.length > 80 && /lg-examples-response/.test(q.instructions));
    T.eq(q.respondWith.fileName, 'lg-response-examples-2026-11-25.json');
    T.ok(q.respondWith.shape && q.respondWith.shape.results);
  });
  T.test('buildRequest endings: plain quiz array, blank marker, 4 options, single-word switch', () => {
    const on = C.buildRequest({ items: [items[0]], task: 'endings', languages: { learning: 'Polish', translation: 'English' }, nowMs: 1, dateIso: '2026-11-25', singleWords: true });
    T.eq([on.format, on.task, on.options], ['lg-endings-request', 'endings', { singleWords: true }]);
    T.ok(/____/.test(on.instructions) && /four options|exactly 4|4 options/i.test(on.instructions));
    T.ok(/short sentence/i.test(on.instructions));
    T.eq(on.respondWith.fileName, 'lg-endings-quiz-2026-11-25.json');
    T.ok(Array.isArray(on.respondWith.shape) && on.respondWith.shape[0].options.length === 4);
    const off = C.buildRequest({ items: [items[0]], task: 'endings', languages: {}, nowMs: 1, dateIso: '2026-11-25', singleWords: false });
    T.ok(!/short sentence/i.test(off.instructions));
  });
  T.test('buildRequest rejects an unknown task', () => {
    T.throws(() => C.buildRequest({ items, task: 'nope', languages: {}, nowMs: 0, dateIso: '2026-11-25' }));
    T.throws(() => C.buildRequest({ items, task: 'aspect', languages: {}, nowMs: 0, dateIso: '2026-11-25' }));
  });
  T.test('file names and the hand-off sentence', () => {
    T.eq(C.requestFileName('endings', '2026-11-25'), 'lg-request-endings-2026-11-25.json');
    const s = C.handoffSentence('lg-request-endings-2026-11-25.json', 'lg-endings-quiz-2026-11-25.json');
    T.ok(s.includes('lg-request-endings-2026-11-25.json') && s.includes('lg-endings-quiz-2026-11-25.json'));
  });
  T.test('parseResponse accepts valid examples results', () => {
    const r = C.parseResponse(GOOD({ results: { a: { sentence: 'Mój dom jest duży.', translation: 'My house is big.' } } }), { ids });
    T.eq([r.ok, r.task, r.requestId, r.unknown, r.rejected], [true, 'examples', 'r-1', 0, []]);
    T.eq(r.results.a, { sentence: 'Mój dom jest duży.', translation: 'My house is big.' });
  });
  T.test('parseResponse: not JSON, wrong format, version or task', () => {
    T.eq(C.parseResponse('{nope', { ids }).ok, false);
    T.eq(C.parseResponse(GOOD({ format: 'other' }), { ids }).ok, false);
    T.eq(C.parseResponse(GOOD({ format: 'lg-ask-claude-response' }), { ids }).ok, false);
    T.eq(C.parseResponse(GOOD({ version: 2 }), { ids }).ok, false);
    T.eq(C.parseResponse(GOOD({ task: 'endings' }), { ids }).ok, false);
    T.eq(C.parseResponse(GOOD({ results: [] }), { ids }).ok, false);
    T.ok(/JSON/.test(C.parseResponse('{nope', { ids }).error));
  });
  T.test('parseResponse counts unknown ids and rejects invalid results with a reason', () => {
    const r = C.parseResponse(GOOD({ results: { zzz: { sentence: 'a', translation: 'b' }, a: { sentence: 'x' }, d: 'text', b: { sentence: 5, translation: 'ok' } } }), { ids });
    T.eq([r.ok, r.unknown, Object.keys(r.results)], [true, 1, []]);
    T.eq(r.rejected.map((x) => x.id).sort(), ['a', 'b', 'd']);
    T.ok(r.rejected.every((x) => typeof x.reason === 'string' && x.reason));
  });
  T.test('parseResponse cleans text and rejects over-long; ignores extra fields; warns on another request id', () => {
    const r = C.parseResponse(GOOD({ results: { a: { sentence: '  Mój   dom\u0000 jest\n duży. ', translation: 'My house.', evil: '<script>' }, d: { sentence: 'x'.repeat(201), translation: 'y' } } }),
      { ids, lastRequest: { requestId: 'r-other', task: 'examples', ids: ['a'] } });
    T.eq(r.results.a, { sentence: 'Mój dom jest duży.', translation: 'My house.' });
    T.eq(r.rejected.map((x) => x.id), ['d']);
    T.eq(r.warnings.length, 1);
    T.eq(C.parseResponse(GOOD(), { ids, lastRequest: { requestId: 'r-1', task: 'examples', ids: [] } }).warnings, []);
  });
  T.test('parseResponse refuses a file over 1 MB', () => {
    T.eq(C.parseResponse(GOOD({ note: 'x'.repeat(1100000) }), { ids }).ok, false);
  });
  T.test('parseQuiz accepts a plain array and a one-array wrapper', () => {
    const r = C.parseQuiz(JSON.stringify([Q(), Q({ question: 'Mieszkam w ____ .', options: ['Polska', 'Polski', 'Polsce', 'Polskę'], correctIndex: 2 })]));
    T.eq([r.ok, r.questions.length, r.rejected], [true, 2, []]);
    T.eq(r.questions[0], { question: 'Idę do ____ .', options: ['basen', 'basenu', 'basenie', 'basenem'], correctIndex: 1 });
    const w = C.parseQuiz(JSON.stringify({ items: [Q()] }));
    T.eq([w.ok, w.questions.length], [true, 1]);
  });
  T.test('parseQuiz rejects bad questions with a reason and keeps the good ones', () => {
    const r = C.parseQuiz(JSON.stringify([
      Q(), Q({ options: ['a', 'b', 'c'] }), Q({ options: ['a', 'a', 'b', 'c'] }), Q({ correctIndex: 4 }), Q({ correctIndex: '1' }),
      Q({ question: '   ' }), Q({ options: ['a', 'b', 'c', ''] }), 'text', Q({ options: ['basen', 'BASEN', 'basenu', 'x'] }),
    ]));
    T.eq([r.ok, r.questions.length, r.rejected.length], [true, 1, 8]);
    T.ok(r.rejected.every((x) => typeof x.index === 'number' && typeof x.reason === 'string' && x.reason));
  });
  T.test('parseQuiz cleans text, drops extra fields and over-long questions; errors for non-quiz files', () => {
    const r = C.parseQuiz(JSON.stringify([Q({ question: '  Idę  do\u0000 ____ . ', id: 'a', explanation: 'x' }), Q({ question: 'x'.repeat(301) })]));
    T.eq(r.questions, [{ question: 'Idę do ____ .', options: ['basen', 'basenu', 'basenie', 'basenem'], correctIndex: 1 }]);
    T.eq(r.rejected.length, 1);
    T.eq(C.parseQuiz('{nope').ok, false);
    T.eq(C.parseQuiz('{"a":1}').ok, false);
    T.eq(C.parseQuiz('[]').ok, false);
    T.eq(C.parseQuiz('x'.repeat(1100000)).ok, false);
  });
  T.test('quizFileName', () => {
    T.eq(C.quizFileName('2026-11-25'), 'lg-endings-quiz-2026-11-25.json');
  });
  T.test('formatResult: examples as one line', () => {
    T.eq(C.formatResult('examples', { sentence: 'Mam kota.', translation: 'I have a cat.' }), 'Mam kota. — I have a cat.');
    T.eq(C.formatResult('examples', undefined), '');
  });
  T.test('mergeNotes adds under the task, replaces an old answer, keeps others; does not mutate', () => {
    const base = { version: 1, byId: { a: { examples: { sentence: 'old', translation: 'o' } } }, lastRequest: null };
    const next = C.mergeNotes(base, 'examples', { a: { sentence: 's', translation: 't' }, d: { sentence: 'k', translation: 'c' } });
    T.eq(next.byId.a, { examples: { sentence: 's', translation: 't' } });
    T.eq(Object.keys(next.byId).sort(), ['a', 'd']);
    T.eq(base.byId.a.examples.sentence, 'old');
  });
  T.test('withLastRequest and countNotes', () => {
    const n = C.withLastRequest(C.emptyNotes(), { requestId: 'r-1', task: 'examples', items: [{ id: 'a' }, { id: 'b' }] });
    T.eq(n.lastRequest, { requestId: 'r-1', task: 'examples', ids: ['a', 'b'] });
    T.eq(C.countNotes(C.mergeNotes(C.emptyNotes(), 'examples', { a: { sentence: 'x', translation: 'y' }, b: { sentence: 'x', translation: 'y' } })), 2);
  });
  T.test('carryNotes moves notes to the corrected row; an existing entry for the new id wins', () => {
    const notes = { version: 1, byId: { o1: { examples: { sentence: 'a', translation: 'b' } }, o2: { examples: { sentence: 'c', translation: 'd' } }, n2: { examples: { sentence: 'keep', translation: 'k' } } }, lastRequest: null };
    const next = C.carryNotes(notes, [{ from: 'o1', to: 'n1' }, { from: 'o2', to: 'n2' }]);
    T.eq(Object.keys(next.byId).sort(), ['n1', 'n2']);
    T.eq(next.byId.n2.examples.sentence, 'keep');
    T.eq(C.carryNotes(notes, []), notes);
  });
  T.test('normaliseNotes tolerates junk and drops entries of removed tasks', () => {
    T.eq(C.normaliseNotes(null), C.emptyNotes());
    T.eq(C.normaliseNotes({ byId: 5 }), C.emptyNotes());
    const n = C.normaliseNotes({ version: 1, byId: { a: { examples: { sentence: 's', translation: 't' }, aspect: { pf: 'x' } }, b: { aspect: { pf: 'x' } } } });
    T.eq(n.byId, { a: { examples: { sentence: 's', translation: 't' } } });
  });
})();
