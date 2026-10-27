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

  LG.dom = { h, clear, download, pickFile };
})(globalThis.LG = globalThis.LG || {});
