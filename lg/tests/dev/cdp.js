// Dev-only CDP driver for headless Edge (virtual-time screenshots stay blank because IndexedDB never resolves).
// Usage: node tests/dev/cdp.js <profileDir> <w>x<h> <script.js>   (keep profiles and screenshots under .tmp/)
// script exports async (b) => {...} with b.go(url), b.wait(ms), b.eval(expr), b.shot(path), b.setFile(sel, path), b.click(sel), b.mouse(x, y), b.key(key)
const { spawn } = require('child_process');
const fs = require('fs');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const [profile, size, scriptPath] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + require('path').resolve(profile), '--window-size=' + w + ',' + h, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let list;
  for (let i = 0; i < 50; i++) { try { list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); if (list.some((t) => t.type === 'page')) break; } catch (e) {} await sleep(200); }
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const logs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text));
    if (m.method === 'Page.fileChooserOpened') { const f = b.nextFile; b.nextFile = null; logs.push('CHOOSER -> ' + f); if (f) send('DOM.setFileInputFiles', { files: [f], backendNodeId: m.params.backendNodeId }); }
    if (m.method === 'Page.javascriptDialogOpening') { logs.push('DIALOG: ' + m.params.message); send('Page.handleJavaScriptDialog', { accept: true }); }
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Page.setInterceptFileChooserDialog', { enabled: true }); await send('Runtime.enable'); await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  var b; b = {
    logs,
    go: async (url) => { await send('Page.navigate', { url }); await sleep(1500); },
    wait: sleep,
    eval: async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true }); return r.result && r.result.result ? r.result.result.value : r; },
    shot: async (p, full) => {
      let clip;
      if (full) { const m = await send('Page.getLayoutMetrics'); const c = m.result.cssContentSize; clip = { x: 0, y: 0, width: w, height: Math.ceil(c.height), scale: 1 }; }
      const r = await send('Page.captureScreenshot', Object.assign({ format: 'png', captureBeyondViewport: !!full }, clip ? { clip } : {}));
      fs.writeFileSync(p, Buffer.from(r.result.data, 'base64'));
    },
    mouse: async (x, y) => {
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    },
    key: async (key) => {
      const code = key === ' ' ? 'Space' : /^[0-9]$/.test(key) ? 'Digit' + key : key;
      const vk = key === ' ' ? 32 : key === 'Enter' ? 13 : key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0;
      const text = key === 'Enter' ? String.fromCharCode(13) : key.length === 1 ? key : undefined;
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, text });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
    },
    click: async (sel) => { const r = await send('Runtime.evaluate', { expression: '(() => { const el = document.querySelector(' + JSON.stringify(sel) + '); if (!el) return false; el.click(); return true; })()', returnByValue: true, userGesture: true }); return r.result.result.value; },
    setFile: async (sel, file) => {
      const doc = await send('DOM.getDocument', { depth: -1, pierce: true });
      const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: sel });
      return send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [file] });
    },
  };
  try { await require(require('path').resolve(scriptPath))(b); }
  catch (e) { console.log('SCRIPT ERROR', e); }
  console.log(logs.filter((l) => !/ProtocolLaunch/.test(l)).join('\n'));
  ws.close(); proc.kill(); await sleep(500); process.exit(0);
})();
