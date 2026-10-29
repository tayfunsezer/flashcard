(function (LG) {
  const FORMAT = 'language-game-progress';
  const VERSION = 1;

  function defaultState() {
    return {
      version: VERSION,
      settings: { theme: 'system', langSource: '', langTarget: '', direction: 's2t', learnColumn: 1 },
      progress: {},
      xp: 0,
      streak: { current: 0, best: 0, lastDay: null },
      daily: { date: null, guesses: [], done: false, won: false },
      studySet: null,
      lastExport: null,
    };
  }

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clone = (v) => JSON.parse(JSON.stringify(v));

  const isStr = (v) => typeof v === 'string';
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const strArr = (v) => Array.isArray(v) && v.every(isStr);
  const pick = (ok, v, d) => (ok(v) ? v : d);
  const oneOf = (list, v, d) => (list.includes(v) ? v : d);
  const strOrNull = (v) => (isStr(v) ? v : null);

  function validStudySet(v) {
    if (!isObj(v)) return null;
    if (!isStr(v.by) || !isStr(v.value) || !isStr(v.game) || !strArr(v.queue) || !strArr(v.done) || !isNum(v.total)) return null;
    return clone(v);
  }

  // Coerce arbitrary parsed JSON into a State: fill missing keys, fall back to the default
  // when a value has the wrong type, and leave unknown keys out.
  function withDefaults(obj) {
    const d = defaultState();
    const o = isObj(obj) ? obj : {};
    const se = isObj(o.settings) ? o.settings : {};
    const st = isObj(o.streak) ? o.streak : {};
    const da = isObj(o.daily) ? o.daily : {};
    const progress = {};
    if (isObj(o.progress)) {
      for (const id of Object.keys(o.progress)) if (isObj(o.progress[id])) {
          const e = clone(o.progress[id]);
          if (e.pin !== undefined) {
            if (Array.isArray(e.pin)) e.pin = e.pin.length && e.pin.every((w) => typeof w === 'string' && w) ? e.pin : null;
            else if (typeof e.pin !== 'string' || !e.pin) e.pin = null;
          }
          progress[id] = e;
        }
    }
    return {
      version: VERSION,
      settings: {
        theme: oneOf(['system', 'light', 'dark'], se.theme, d.settings.theme),
        langSource: pick(isStr, se.langSource, d.settings.langSource),
        langTarget: pick(isStr, se.langTarget, d.settings.langTarget),
        direction: oneOf(['s2t', 't2s'], se.direction, d.settings.direction),
        learnColumn: oneOf([1, 2], se.learnColumn, d.settings.learnColumn),
      },
      progress,
      xp: pick(isNum, o.xp, d.xp),
      streak: {
        current: pick(isNum, st.current, 0),
        best: pick(isNum, st.best, 0),
        lastDay: strOrNull(st.lastDay),
      },
      daily: {
        date: strOrNull(da.date),
        guesses: strArr(da.guesses) ? da.guesses.slice() : [],
        done: pick((v) => typeof v === 'boolean', da.done, false),
        won: pick((v) => typeof v === 'boolean', da.won, false),
      },
      studySet: validStudySet(o.studySet),
      lastExport: pick(isNum, o.lastExport, null),
    };
  }

  function exportProgress(state, nowMs) {
    const copy = clone(state);
    copy.lastExport = nowMs;
    return { format: FORMAT, version: VERSION, exportedAt: nowMs, state: copy };
  }

  function exportFileName(iso) {
    return FORMAT + '-' + iso + '.json';
  }

  function parseProgressFile(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'Not a valid JSON file.' }; }
    if (!isObj(data) || data.format !== FORMAT) return { ok: false, error: 'This is not a Language Game progress file.' };
    if (data.version > VERSION) {
      return { ok: false, error: 'This file was made by a newer version (v' + data.version + ') and cannot be imported.' };
    }
    if (!isObj(data.state)) return { ok: false, error: 'This is not a Language Game progress file.' };
    const state = withDefaults(data.state);
    return {
      ok: true,
      state,
      summary: { exportedAt: data.exportedAt, itemCount: Object.keys(state.progress).length, xp: state.xp },
    };
  }

  LG.state = { FORMAT, VERSION, defaultState, withDefaults, exportProgress, exportFileName, parseProgressFile };
})(globalThis.LG = globalThis.LG || {});
