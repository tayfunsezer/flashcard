// Dev-only: Refresh file via the fallback picker (showOpenFilePicker disabled). Run: node tests/dev/cdp.js .tmp/prof-refresh 1280x900 tests/dev/refresh-check.js
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
module.exports = async (b) => {
  const ok = (c, m) => console.log((c ? 'OK ' : 'FAIL ') + m);
  const csv = path.resolve(__dirname, '../../.tmp/refresh.csv');
  fs.mkdirSync(path.dirname(csv), { recursive: true });
  fs.writeFileSync(csv, 'dom,house\nkot,cat\npies,dog\n');
  // No handle: Refresh shows a banner; its Choose file button (a fresh click) opens the picker.
  const viaBanner = async () => {
    await b.click('.topbar .refresh-file'); await b.wait(400);
    ok(await b.eval('document.querySelector("#banners .banner span")?.textContent') === 'Pick the file again to refresh it.', 'pick-again banner');
    await b.click('#banners .choose-file'); await b.wait(1200);
  };
  const noPicker = 'window.showOpenFilePicker = undefined';
  await b.go(pathToFileURL(path.resolve(__dirname, '../../index.html')).href); await b.wait(1000);
  await b.eval(noPicker);
  b.nextFile = csv;
  await b.eval('[...document.querySelectorAll("button")].find(x=>x.textContent==="Choose file").click()'); await b.wait(1000);
  await b.eval('(()=>{const s=document.querySelectorAll("select");s[0].value="pl";s[0].dispatchEvent(new Event("change"));s[1].value="en";s[1].dispatchEvent(new Event("change"));})()'); await b.wait(200);
  await b.eval('[...document.querySelectorAll("button")].find(x=>x.textContent==="Start").click()'); await b.wait(800);
  ok(await b.eval('document.querySelector(".file-info").textContent') === 'refresh.csv · 3 items', 'loaded 3 items');
  ok(await b.eval('!!document.querySelector(".topbar .refresh-file")'), 'Home shows Refresh file');
  ok(await b.eval('LG.storage.loadHandle()') === null, 'no handle stored on fallback');

  fs.writeFileSync(csv, 'dom,house\nkot,a cat\npies,dog\nryba,fish\n');
  b.nextFile = csv;
  await b.eval(noPicker);
  await viaBanner();
  const text = await b.eval('[...document.querySelectorAll("#banners .banner span")].map(s=>s.textContent).join("|")');
  ok(text === 'Refreshed refresh.csv: 4 items (+2 new, −1 gone)', 'banner ' + text);
  ok(await b.eval('document.querySelector(".file-info").textContent') === 'refresh.csv · 4 items', 'Home shows 4 items');

  // In-game ↻ exists in Cloze header (confirm is auto-accepted by the driver).
  await b.eval('LG.app.go("cloze", { ids: LG.app.reviewRound("cloze", LG.app.ctx.items.map(i=>i.id)), mode: "review" })'); await b.wait(400);
  ok(await b.eval('document.querySelector(".game-head .refresh-file")?.getAttribute("aria-label")') === 'Refresh file', 'Cloze header has ↻');
  await b.eval('LG.app.go("leitner")'); await b.wait(300);
  ok(await b.eval('!!document.querySelector(".leitner .refresh-file")'), 'Leitner header has ↻');
  await b.eval('LG.app.go("home")'); await b.wait(300);

  fs.writeFileSync(csv, 'Source,Target,Date,Category\n');
  b.nextFile = csv;
  await b.eval(noPicker);
  await viaBanner();
  const err = await b.eval('[...document.querySelectorAll("#banners .banner-error span")].map(s=>s.textContent).join("|")');
  ok(/^Could not refresh: /.test(err), 'error banner ' + err);
  ok(await b.eval('!!document.querySelector("#banners .banner-error .load-file")'), 'error banner has Load file…');
  ok(await b.eval('LG.app.dataset.items.length') === 4 && await b.eval('document.querySelector(".file-info").textContent') === 'refresh.csv · 4 items', 'still 4 items');

  // A different file name goes to the load screen as a fresh import.
  const other = path.resolve(__dirname, '../../.tmp/other.csv');
  fs.writeFileSync(other, 'kot,cat\n');
  b.nextFile = other;
  await b.eval(noPicker);
  await viaBanner();
  ok(await b.eval('LG.app.current') === 'load' && await b.eval('document.querySelector("h1").textContent') === 'Check the import', 'other file opens the import check');

  // Case-insensitive same-name check: REFRESH.CSV is the same file.
  const upper = path.resolve(__dirname, '../../.tmp/REFRESH.CSV');
  await b.eval('LG.app.go("home")'); await b.wait(300);
  fs.writeFileSync(upper, ['dom,house', 'kot,cat', ''].join(String.fromCharCode(10)));
  b.nextFile = upper;
  await b.eval(noPicker);
  await viaBanner();
  ok(await b.eval('LG.app.current') === 'home', 'case-different name refreshes, not import: ' + await b.eval('LG.app.current'));

  // learnColumn is stored on the dataset and survives a settings change.
  ok(await b.eval('LG.app.dataset.learnColumn') === 1, 'dataset keeps learnColumn');

  // Sample data hides the Home button.
  await b.eval('LG.app.setDataset({ items: LG.importer.rowsToDataset(LG.sampleRows, { learnColumn: 1 }).items, fileName: "Sample data" }); LG.app.go("home")'); await b.wait(300);
  ok(await b.eval('!document.querySelector(".refresh-file")'), 'no Refresh for sample');
};
