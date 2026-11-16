// Dev-only: Export marked captures a quiz file; Clear all marks. Run: node tests/dev/cdp.js .tmp/prof-export 1280x900 tests/dev/export-check.js
const path = require('path');
const { pathToFileURL } = require('url');
module.exports = async (b) => {
  const ok = (c, m) => console.log((c ? 'OK ' : 'FAIL ') + m);
  await b.go(pathToFileURL(path.resolve(__dirname, '../../index.html')).href + '?sample=1'); await b.wait(1500);
  await b.eval('(()=>{const ids=LG.app.ctx.items.slice(0,2).map(i=>i.id);let s=LG.app.state;for(const id of ids)s=LG.play.setStar(s,id,true);LG.app.setState(s);LG.app.refresh();})()'); await b.wait(300);
  await b.eval('window.__dl=null;LG.dom.download=(n,t)=>{window.__dl=[n,t];}');
  await b.eval('document.querySelector("input[value=marked]").click()'); await b.wait(300);
  const label = await b.eval('document.querySelector(".mode-note + .btn-row .export-marked").textContent');
  ok(label === 'Export marked (2)', 'label ' + label);
  await b.eval('document.querySelector(".mode-note + .btn-row .export-marked").click()'); await b.wait(200);
  const dl = JSON.parse(await b.eval('JSON.stringify(window.__dl)'));
  ok(/^marked-sample-\d{4}-\d{2}-\d{2}\.json$/.test(dl[0]), 'file name ' + dl[0]);
  ok(JSON.parse(dl[1]).length === 2, 'JSON has 2 entries');
  await b.eval('window.confirm=()=>true;document.querySelector(".clear-marks").click()'); await b.wait(300);
  ok(await b.eval('LG.play.markedIds(LG.app.ctx.items.map(i=>i.id),LG.app.state.progress).length') === 0, 'marks cleared');
  ok(await b.eval('document.querySelector(".export-marked").disabled') === true, 'export disabled at 0');
  console.log(b.logs.join('\n'));
};
