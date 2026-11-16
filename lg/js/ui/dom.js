(function (LG) {
  function append(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { for (const c of child) append(el, c); return; }
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  // h('button', { class: 'btn', onclick: fn, dataset: { id: 'x' }, disabled: true }, 'Label', [more], null)
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
      children.unshift(attrs);
      attrs = null;
    }
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' && 'value' in el) el.value = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    append(el, children);
    return el;
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  function download(fileName, text, mime = 'application/json') {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = h('a', { href: url, download: fileName, class: 'hidden' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function pickFile(accept) {
    return new Promise((resolve) => {
      const input = h('input', { type: 'file', accept, class: 'hidden' });
      let settled = false;
      const done = (f) => { if (!settled) { settled = true; input.remove(); resolve(f); } };
      input.addEventListener('change', () => done((input.files && input.files[0]) || null));
      input.addEventListener('cancel', () => done(null));
      document.body.appendChild(input);
      input.click();
    });
  }

  // { file, handle } from the File System Access picker where it exists (handle allows Refresh file later),
  // otherwise from the plain file input with handle null. null when the user cancels.
  async function pickFileWithHandle(accept) {
    if (typeof globalThis.showOpenFilePicker !== 'function') {
      const file = await pickFile(accept);
      return file ? { file, handle: null } : null;
    }
    const exts = String(accept).split(',').map((e) => e.trim()).filter(Boolean);
    let handles;
    try {
      handles = await globalThis.showOpenFilePicker({
        types: [{ description: 'Word lists', accept: { 'application/octet-stream': exts } }],
        excludeAcceptAllOption: false,
        multiple: false,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') return null;
      // After an await the click no longer counts as a user action, so a second picker may be blocked: let the user retry.
      const err = new Error('The browser could not open its file picker (' + ((e && e.name) || 'error') + '). Choose the file again with the button below.');
      err.retryPlain = true;
      throw err;
    }
    const handle = handles && handles[0];
    if (!handle) return null;
    try {
      return { file: await handle.getFile(), handle };
    } catch (e) {
      // The browser picked a file but would not let the page read it through the handle.
      const err = new Error('The browser did not allow reading the picked file (' + ((e && e.name) || 'error') + '). Choose it again with the button below.');
      err.retryPlain = true;
      throw err;
    }
  }

  // Resolves to `fallback` when `promise` has not settled within `ms` (or rejects): some file-access calls can hang.
  function withTimeout(promise, ms, fallback) {
    return Promise.race([Promise.resolve(promise).catch(() => fallback), new Promise((r) => setTimeout(() => r(fallback), ms))]);
  }

  LG.dom = { h, clear, download, pickFile, pickFileWithHandle, withTimeout };
})(globalThis.LG = globalThis.LG || {});
