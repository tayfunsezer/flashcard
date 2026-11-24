(function () {
  const C = LG.claude;
  const it = (id, source, target, categories) => ({ id, source, target, date: null, categories: categories || [] });
  const items = [
    it('a', 'house', 'dom', ['x']), it('b', 'to do', 'robić & zrobić', ['Verb']),
    it('c', 'I am going to the pool', 'Idę do basenu dziś rano', ['Expressions']), it('d', 'cat', 'kot', ['x']),
  ];
  const ids = new Set(items.map((x) => x.id));
  const GOOD = (extra) => JSON.stringify(Object.assign({ format: 'lg-ask-claude-response', version: 1, requestId: 'r-1', task: 'examples', results: {} }, extra));

  T.test('selectItems: examples skips sentences and items that already have notes; counts them', () => {
    const notes = { version: 1, byId: { d: { examples: { sentence: 'Kot śpi.', translation: 'The cat sleeps.' } } }, lastRequest: null };
    const r = C.selectItems(items, 'examples', notes, { lang: 'pl', skipDone: true, cap: 60 });
    T.eq(r.items.map((x) => x.id), ['a', 'b']);
    T.eq([r.done, r.cap], [1, false]);
    const all = C.selectItems(items, 'examples', notes, { lang: 'pl', skipDone: false, cap: 60 });
    T.eq(all.items.map((x) => x.id), ['a', 'b', 'd']);
  });
  T.test('selectItems: aspect keeps every item; cap truncates and says so', () => {
    const r = C.selectItems(items, 'aspect', C.emptyNotes(), { lang: 'pl', skipDone: true, cap: 2 });
    T.eq([r.items.length, r.cap, r.total], [2, true, 4]);
  });
  T.test('buildRequest: format, task, ids, instructions and respondWith', () => {
    const q = C.buildRequest({ items: [items[0]], task: 'examples', languages: { learning: 'pl', translation: 'en' }, nowMs: Date.UTC(2026, 10, 25, 1, 0, 0), dateIso: '2026-11-25' });
    T.eq([q.format, q.version, q.task, q.createdAt], ['lg-ask-claude-request', 1, 'examples', '2026-11-25T01:00:00.000Z']);
    T.ok(/^r-20261125-[0-9a-z]{6}$/.test(q.requestId), q.requestId);
    T.eq(q.items, [{ id: 'a', source: 'house', target: 'dom', categories: ['x'] }]);
    T.ok(q.instructions.length > 80 && /lg-ask-claude-response/.test(q.instructions));
    T.eq(q.respondWith.fileName, 'lg-response-examples-2026-11-25.json');
    T.ok(q.respondWith.shape && q.respondWith.shape.results);
  });
  T.test('buildRequest rejects an unknown task', () => {
    T.throws(() => C.buildRequest({ items, task: 'nope', languages: {}, nowMs: 0, dateIso: '2026-11-25' }));
  });
  T.test('file names and the hand-off sentence', () => {
    T.eq(C.requestFileName('aspect', '2026-11-25'), 'lg-request-aspect-2026-11-25.json');
    const s = C.handoffSentence('lg-request-aspect-2026-11-25.json', 'lg-response-aspect-2026-11-25.json');
    T.ok(s.includes('lg-request-aspect-2026-11-25.json') && s.includes('lg-response-aspect-2026-11-25.json'));
  });
  T.test('parseResponse accepts valid examples and aspect results', () => {
    const r = C.parseResponse(GOOD({ results: { a: { sentence: 'Mój dom jest duży.', translation: 'My house is big.' } } }), { ids });
    T.eq([r.ok, r.task, r.requestId, r.unknown, r.rejected], [true, 'examples', 'r-1', 0, []]);
    T.eq(r.results.a, { sentence: 'Mój dom jest duży.', translation: 'My house is big.' });
    const q = C.parseResponse(GOOD({ task: 'aspect', results: { b: { impf: 'robić', pf: 'zrobić' }, d: { pf: 'zrobić' } } }), { ids });
    T.eq(Object.keys(q.results), ['b', 'd']);
    T.eq(q.results.d, { pf: 'zrobić' });
  });
  T.test('parseResponse: not JSON, wrong format, version or task', () => {
    T.eq(C.parseResponse('{nope', { ids }).ok, false);
    T.eq(C.parseResponse(GOOD({ format: 'other' }), { ids }).ok, false);
    T.eq(C.parseResponse(GOOD({ version: 2 }), { ids }).ok, false);
    T.eq(C.parseResponse(GOOD({ task: 'poetry' }), { ids }).ok, false);
    T.eq(C.parseResponse(GOOD({ results: [] }), { ids }).ok, false);
    T.ok(/JSON/.test(C.parseResponse('{nope', { ids }).error));
  });
  T.test('parseResponse counts unknown ids and rejects invalid results with a reason', () => {
    const r = C.parseResponse(GOOD({ results: { zzz: { sentence: 'a', translation: 'b' }, a: { sentence: 'x' }, d: 'text', b: { sentence: 5, translation: 'ok' } } }), { ids });
    T.eq([r.ok, r.unknown, Object.keys(r.results)], [true, 1, []]);
    T.eq(r.rejected.map((x) => x.id).sort(), ['a', 'b', 'd']);
    T.ok(r.rejected.every((x) => typeof x.reason === 'string' && x.reason));
  });
  T.test('parseResponse cleans text: trims, collapses spaces, drops control characters, rejects over-long', () => {
    const r = C.parseResponse(GOOD({ results: { a: { sentence: '  Mój   dom\u0000 jest\n duży. ', translation: 'My house.' }, d: { sentence: 'x'.repeat(201), translation: 'y' } } }), { ids });
    T.eq(r.results.a.sentence, 'Mój dom jest duży.');
    T.eq(r.rejected.map((x) => x.id), ['d']);
  });
  T.test('parseResponse ignores extra fields and warns when the request id differs from the last request', () => {
    const r = C.parseResponse(GOOD({ results: { a: { sentence: 's', translation: 't', evil: '<script>' } } }), { ids, lastRequest: { requestId: 'r-other', task: 'examples', ids: ['a'] } });
    T.eq(r.results.a, { sentence: 's', translation: 't' });
    T.eq(r.warnings.length, 1);
    T.eq(C.parseResponse(GOOD(), { ids, lastRequest: { requestId: 'r-1', task: 'examples', ids: [] } }).warnings, []);
  });
  T.test('parseResponse refuses a file over 1 MB', () => {
    T.eq(C.parseResponse(GOOD({ note: 'x'.repeat(1100000) }), { ids }).ok, false);
  });
  T.test('mergeNotes adds under the task, replaces an old answer, keeps other tasks; does not mutate', () => {
    const base = { version: 1, byId: { a: { aspect: { pf: 'zrobić' } } }, lastRequest: null };
    const next = C.mergeNotes(base, 'examples', { a: { sentence: 's', translation: 't' }, d: { sentence: 'k', translation: 'c' } });
    T.eq(next.byId.a, { aspect: { pf: 'zrobić' }, examples: { sentence: 's', translation: 't' } });
    T.eq(Object.keys(next.byId).sort(), ['a', 'd']);
    T.eq(Object.keys(base.byId), ['a']);
  });
  T.test('withLastRequest and countNotes', () => {
    const n = C.withLastRequest(C.emptyNotes(), { requestId: 'r-1', task: 'aspect', items: [{ id: 'a' }, { id: 'b' }] });
    T.eq(n.lastRequest, { requestId: 'r-1', task: 'aspect', ids: ['a', 'b'] });
    T.eq(C.countNotes(C.mergeNotes(C.emptyNotes(), 'aspect', { a: { pf: 'x' }, b: { pf: 'y' } })), 2);
  });
  T.test('carryNotes moves notes to the corrected row; an existing entry for the new id wins', () => {
    const notes = { version: 1, byId: { o1: { examples: { sentence: 'a', translation: 'b' } }, o2: { aspect: { pf: 'x' } }, n2: { aspect: { pf: 'keep' } } }, lastRequest: null };
    const next = C.carryNotes(notes, [{ from: 'o1', to: 'n1' }, { from: 'o2', to: 'n2' }]);
    T.eq(Object.keys(next.byId).sort(), ['n1', 'n2']);
    T.eq(next.byId.n2, { aspect: { pf: 'keep' } });
    T.eq(C.carryNotes(notes, []), notes);
  });
  T.test('normaliseNotes tolerates junk from storage', () => {
    T.eq(C.normaliseNotes(null), C.emptyNotes());
    T.eq(C.normaliseNotes({ byId: 5 }), C.emptyNotes());
    T.eq(C.normaliseNotes({ version: 1, byId: { a: { examples: { sentence: 's', translation: 't' } } } }).byId.a.examples.sentence, 's');
  });
})();
