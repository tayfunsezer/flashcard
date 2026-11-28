(function (LG) {
  const STATE_KEY = 'lg.state';
  // The last table link, kept apart from lg.state so it never ends up in an exported progress file.
  const LINK_KEY = 'lg.sourceLink';
  const REPEAT_DATE_KEY = 'lg.repeatDate';
  const RESET_WARNING = 'Saved progress could not be read and was reset. Import a backup in Settings if you have one.';
  const DB_NAME = 'lg';
  const STORE = 'dataset';
  const KEY = 'current';
  const HANDLE_KEY = 'handle';
  const DIR_KEY = 'repoDir';
  const READ_DIR_KEY = 'repoReadDir';
  const NOTES_KEY = 'notes';

  function loadState(store) {
    try {
      if (store === undefined) store = globalThis.localStorage;
      const raw = store.getItem(STATE_KEY);
      if (raw === null || raw === undefined) return { state: LG.state.defaultState(), warning: null };
      const parsed = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad state');
      return { state: LG.state.withDefaults(parsed), warning: null };
    } catch (e) {
      return { state: LG.state.defaultState(), warning: RESET_WARNING };
    }
  }

  function saveState(state, store) {
    try {
      if (store === undefined) store = globalThis.localStorage;
      store.setItem(STATE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadLink(store) {
    try {
      if (store === undefined) store = globalThis.localStorage;
      const v = store.getItem(LINK_KEY);
      return typeof v === 'string' ? v : '';
    } catch (e) {
      return '';
    }
  }

  function saveLink(url, store) {
    try {
      if (store === undefined) store = globalThis.localStorage;
      if (url) store.setItem(LINK_KEY, url); else store.removeItem(LINK_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = globalThis.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function run(mode, fn) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  async function saveDataset(ds) { await run('readwrite', (s) => s.put(ds, KEY)); }
  async function loadDataset() { const v = await run('readonly', (s) => s.get(KEY)); return v === undefined ? null : v; }
  async function clearDataset() { await run('readwrite', (s) => s.delete(KEY)); }
  // The last day picked on the Load screen's Repeat words card ('YYYY-MM-DD'), or '' when unset or not a date.
  function loadRepeatDate(store) {
    try {
      if (store === undefined) store = globalThis.localStorage;
      const v = store.getItem(REPEAT_DATE_KEY);
      return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
    } catch (e) {
      return '';
    }
  }

  function saveRepeatDate(date, store) {
    try {
      if (store === undefined) store = globalThis.localStorage;
      if (date) store.setItem(REPEAT_DATE_KEY, date); else store.removeItem(REPEAT_DATE_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  // The loaded file's FileSystemFileHandle (browsers that have one), kept beside the dataset for Refresh file.
  async function saveHandle(handle) { await run('readwrite', (s) => (handle ? s.put(handle, HANDLE_KEY) : s.delete(HANDLE_KEY))); }
  async function loadHandle() { const v = await run('readonly', (s) => s.get(HANDLE_KEY)); return v || null; }

  // The repeated-words folder (a FileSystemDirectoryHandle) chosen on the Export a day screen.
  async function saveDirHandle(handle) { await run('readwrite', (s) => (handle ? s.put(handle, DIR_KEY) : s.delete(DIR_KEY))); }
  async function loadDirHandle() { const v = await run('readonly', (s) => s.get(DIR_KEY)); return v || null; }
  // The folder the Load screen's Repeat words card reads from: its own choice, never Export a day's folder.
  async function saveReadDirHandle(handle) { await run('readwrite', (s) => (handle ? s.put(handle, READ_DIR_KEY) : s.delete(READ_DIR_KEY))); }
  async function loadReadDirHandle() { const v = await run('readonly', (s) => s.get(READ_DIR_KEY)); return v || null; }

  // Answers loaded from Claude (LG.claude notes), kept beside the dataset; never part of the progress export.
  async function saveNotes(notes) { await run('readwrite', (s) => s.put(notes, NOTES_KEY)); }
  async function loadNotes() { const v = await run('readonly', (s) => s.get(NOTES_KEY)); return v === undefined ? null : v; }

  LG.storage = { saveNotes, loadNotes, STATE_KEY, LINK_KEY, REPEAT_DATE_KEY, loadRepeatDate, saveRepeatDate, loadState, saveState, loadLink, saveLink, saveDataset, loadDataset, clearDataset, saveHandle, loadHandle, saveDirHandle, loadDirHandle, saveReadDirHandle, loadReadDirHandle };
})(globalThis.LG = globalThis.LG || {});
