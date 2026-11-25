(function () {
  const S = LG.state;
  const fake = (value, throws) => ({
    getItem() { if (throws) throw new Error('blocked'); return value; },
    setItem(k, v) { this.saved = v; },
  });
  T.test('export → parse round trip', () => {
    const st = S.defaultState(); st.xp = 120; st.progress = { a: { box: 2, due: 1, revenge: false, seen: true, pin: null, rot: 0 } };
    const file = JSON.stringify(S.exportProgress(st, 1000));
    const r = S.parseProgressFile(file);
    T.eq(r.ok, true);
    T.eq(r.summary, { exportedAt: 1000, itemCount: 1, xp: 120 });
    T.eq(r.state.lastExport, 1000);
  });
  T.test('parseProgressFile errors', () => {
    T.eq(S.parseProgressFile('{nope').error, 'Not a valid JSON file.');
    T.eq(S.parseProgressFile('{"format":"x","version":1}').error, 'This is not a Language Game progress file.');
    T.eq(S.parseProgressFile('{"format":"language-game-progress","version":3,"state":{}}').error,
      'This file was made by a newer version (v3) and cannot be imported.');
  });
  T.test('withDefaults v1 pin -> star; v2 keeps unstarred', () => {
    const v1 = S.withDefaults({ version: 1, progress: { a: { pin: ['się'] }, b: { pin: null } } });
    T.eq([v1.version, v1.progress.a.star, !!v1.progress.b.star], [2, true, false]);
    const v2 = S.withDefaults({ version: 2, progress: { a: { pin: ['się'] } } });
    T.eq(!!v2.progress.a.star, false);
    T.eq(S.withDefaults({}).settings.ask, 'word');
    T.eq(S.withDefaults({ settings: { ask: 'whole' } }).settings.ask, 'whole');
    T.eq(S.withDefaults({ settings: { ask: 'bogus' } }).settings.ask, 'word');
  });
  T.test('exportFileName', () => T.eq(S.exportFileName('2025-12-13'), 'language-game-progress-2025-12-13.json'));
  T.test('loadState: missing, corrupt, blocked, partial', () => {
    T.eq(LG.storage.loadState(fake(null)), { state: S.defaultState(), warning: null });
    T.ok(LG.storage.loadState(fake('{bad')).warning.startsWith('Saved progress could not be read'));
    T.ok(LG.storage.loadState(fake(null, true)).warning !== null);
    const partial = LG.storage.loadState(fake('{"version":1,"xp":7}')).state;
    T.eq(partial.xp, 7);
    T.eq(partial.settings.theme, 'system');
    T.eq(partial.streak, { current: 0, best: 0, lastDay: null });
  });
  T.test('saveState writes JSON', () => {
    const f = fake(null);
    T.eq(LG.storage.saveState(S.defaultState(), f), true);
    T.eq(JSON.parse(f.saved).version, 2);
  });
  T.test('loadState/saveState survive a throwing default localStorage', () => {
    const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    try {
      T.ok(LG.storage.loadState().warning !== null);
      T.eq(LG.storage.saveState(S.defaultState()), false);
    } finally {
      if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage;
    }
  });
  T.test('withDefaults coerces wrong types', () => {
    const st = S.withDefaults({
      xp: 'abc', settings: { theme: 5, direction: 'x', langSource: 3 },
      daily: { guesses: 'x', done: 'y' }, streak: { current: Infinity, lastDay: 4 },
      progress: { a: null, b: 5, c: { box: 1 } }, studySet: {}, lastExport: 'z',
    });
    T.eq(st, Object.assign(S.defaultState(), { progress: { c: { box: 1 } } }));
    T.eq(S.withDefaults({ daily: { guesses: [1] } }).daily.guesses, []);
    T.eq(S.withDefaults(null), S.defaultState());
  });
  T.test('withDefaults keeps a valid studySet', () => {
    const ss = { by: 'category', value: 'Animals', game: 'mc', queue: ['a'], total: 2, done: ['b'] };
    T.eq(S.withDefaults({ studySet: ss }).studySet, ss);
    T.eq(S.withDefaults({ studySet: Object.assign({}, ss, { queue: [1] }) }).studySet, null);
    T.eq(S.parseProgressFile('{"format":"language-game-progress","version":1,"state":{"xp":"abc"}}').state.xp, 0);
  });
  T.test('settings.learnColumn default and validation', () => {
    T.eq(LG.state.defaultState().settings.learnColumn, 1);
    T.eq(LG.state.withDefaults({ settings: { learnColumn: 2 } }).settings.learnColumn, 2);
    T.eq(LG.state.withDefaults({ settings: { learnColumn: 3 } }).settings.learnColumn, 1);
    T.eq(LG.state.withDefaults({ settings: { learnColumn: '2' } }).settings.learnColumn, 1);
  });
  T.test('the remembered link lives under its own key, not in lg.state', () => {
    const mem = { data: {}, getItem(k) { return k in this.data ? this.data[k] : null; }, setItem(k, v) { this.data[k] = String(v); }, removeItem(k) { delete this.data[k]; } };
    T.eq(LG.storage.loadLink(mem), '');
    T.eq(LG.storage.saveLink('https://x.test/a.tsv', mem), true);
    T.eq(LG.storage.loadLink(mem), 'https://x.test/a.tsv');
    T.ok(LG.storage.LINK_KEY !== LG.storage.STATE_KEY && !('lg.state' in mem.data));
    T.eq(LG.storage.saveLink('', mem), true);
    T.eq(LG.storage.loadLink(mem), '');
  });
  T.test('the remembered link survives a throwing or missing localStorage', () => {
    const boom = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); }, removeItem() { throw new Error('x'); } };
    T.eq(LG.storage.loadLink(boom), '');
    T.eq(LG.storage.saveLink('https://x.test/a', boom), false);
    T.eq(LG.storage.loadLink({ getItem: () => 42 }), '');
  });
  T.test('withDefaults keeps array pins, drops bad ones', () => {
    const s = LG.state.withDefaults({ progress: { a: { pin: ['boję', 'się'] }, b: { pin: [1] }, c: { pin: 'x' } } });
    T.eq([s.progress.a.pin, s.progress.b.pin, s.progress.c.pin], [['boję', 'się'], null, 'x']);
  });
  T.test('settings.voices: default, old states, validation', () => {
    T.eq(S.defaultState().settings.voices, {});
    T.eq(S.withDefaults({}).settings.voices, {});
    T.eq(S.withDefaults({ version: 2, settings: { theme: 'dark' } }).settings.voices, {});
    T.eq(S.withDefaults({ settings: { voices: { pl: 'Ewa (Premium)' } } }).settings.voices, { pl: 'Ewa (Premium)' });
    for (const bad of ['x', ['a'], 5, null]) T.eq(S.withDefaults({ settings: { voices: bad } }).settings.voices, {});
    T.eq(S.withDefaults({ settings: { voices: { pl: 5, de: 'Anna' } } }).settings.voices, { de: 'Anna' });
  });
  T.test('settings.speakMatch: default on, kept when off, bad values reset', () => {
    T.eq(S.defaultState().settings.speakMatch, true);
    T.eq(S.withDefaults({}).settings.speakMatch, true);
    T.eq(S.withDefaults({ settings: { theme: 'dark' } }).settings.speakMatch, true);
    T.eq(S.withDefaults({ settings: { speakMatch: false } }).settings.speakMatch, false);
    T.eq(S.withDefaults({ settings: { speakMatch: 'no' } }).settings.speakMatch, true);
  });
  T.test('settings.speechRate: default 0.85, clamped to 0.5..1.5, bad values reset', () => {
    T.eq(S.defaultState().settings.speechRate, 0.85);
    T.eq(S.withDefaults({}).settings.speechRate, 0.85);
    T.eq(S.withDefaults({ settings: { speechRate: 0.7 } }).settings.speechRate, 0.7);
    T.eq(S.withDefaults({ settings: { speechRate: 0.1 } }).settings.speechRate, 0.5);
    T.eq(S.withDefaults({ settings: { speechRate: 9 } }).settings.speechRate, 1.5);
    for (const bad of ['fast', null, NaN, {}]) T.eq(S.withDefaults({ settings: { speechRate: bad } }).settings.speechRate, 0.85);
  });
})();
