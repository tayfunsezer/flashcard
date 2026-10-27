(function (LG) {
  const STATE_KEY = 'lg.state';
  const RESET_WARNING = 'Saved progress could not be read and was reset. Import a backup in Settings if you have one.';
  const DB_NAME = 'lg';
  const STORE = 'dataset';
  const KEY = 'current';

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

  LG.storage = { STATE_KEY, loadState, saveState, saveDataset, loadDataset, clearDataset };
})(globalThis.LG = globalThis.LG || {});
