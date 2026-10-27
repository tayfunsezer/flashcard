// Dev-only: checks for the final-review fixes. Env: BASE (file url of index.html).
const fs = require('fs');
module.exports = async (b) => {
  const base = process.env.BASE;
  const clickText = (t) => b.eval('(()=>{const el=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()===' + JSON.stringify(t) + ');if(!el)return false;el.click();return true})()');
  const pick = async (file) => { b.nextFile = file; await clickText('Choose file'); await b.wait(1200); };
  await b.go(base + '?sample=1'); await b.wait(800);
  const rows = JSON.parse(await b.eval('JSON.stringify(LG.sampleRows)'));
  const q = JSON.parse(await b.eval(`(()=>{const a=LG.app;const ids=LG.play.eligibleIds(LG.words.itemsInCategory(a.ctx.items,'Food'),'cloze','pl');
    const set=LG.study.createStudySet({by:'category',value:'Food',game:'cloze'},ids,Math.random);a.setState(Object.assign({},a.state,{studySet:set}));return JSON.stringify(set.queue)})()`));
  console.log('(a) study set queue before', q.length);
  const drop = new Set(q.slice(0, 2));
  const dropRows = JSON.parse(await b.eval('JSON.stringify(' + JSON.stringify(q.slice(0, 2)) + '.map(id=>{const it=LG.app.ctx.itemsById.get(id);return [it.target,it.source]}))'));
  const keep = rows.filter((r) => !dropRows.some((d) => d[0] === r[0] && d[1] === r[1]));
  const csv = keep.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  fs.mkdirSync('.tmp/ff', { recursive: true });
  fs.writeFileSync('.tmp/ff/partial.csv', '\ufeff' + csv, 'utf8');
  await b.eval('LG.app.go("load")'); await b.wait(300);
  await pick(require('path').resolve('.tmp/ff/partial.csv'));
  console.log('summary items', await b.eval('[...document.querySelectorAll("dd")].slice(0,2).map(d=>d.textContent).join(" | ")'));
  await clickText('Start'); await b.wait(500);
  console.log('studySet after', await b.eval('JSON.stringify(LG.app.state.studySet&&{q:LG.app.state.studySet.queue.length,t:LG.app.state.studySet.total,d:LG.app.state.studySet.done.length})'));
  console.log('home resume text', await b.eval('[...document.querySelectorAll(".card")].map(c=>c.textContent).find(t=>/Resume study set/.test(t))'));
  console.log('banners', await b.eval('[...document.querySelectorAll(".banner")].map(x=>x.dataset.text).join(" || ")'));
  await clickText('Resume'); await b.wait(500);
  console.log('resume screen', await b.eval('LG.app.current'), 'errors', await b.eval('document.querySelectorAll(".banner-error").length'));

  // (b) UTF-16LE .txt
  const txt = ['Source\tTarget\tDate\tCategory', 'turtle\tżółw\t13-10-2026\tAnimals', 'cat\tkot\t13-10-2026\tAnimals', 'the old turtle sleeps slowly\tstary żółw śpi powoli\t13-10-2026\tAnimals'].join('\r\n');
  fs.writeFileSync('.tmp/ff/excel.txt', Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(txt, 'utf16le')]));
  await b.eval('LG.app.go("load")'); await b.wait(300);
  await pick(require('path').resolve('.tmp/ff/excel.txt'));
  console.log('(b) summary', await b.eval('[...document.querySelectorAll("dt")].map((d,i)=>d.textContent+"="+document.querySelectorAll("dd")[i].textContent).join("; ")'));
  await clickText('Start'); await b.wait(500);
  console.log('(b) items', await b.eval('JSON.stringify(LG.app.dataset.items.map(i=>[i.source,i.target]))'));
  console.log('(b) studySet', await b.eval('JSON.stringify(LG.app.state.studySet)'));

  // (c) MC cloze casing on sample data
  await b.eval('(async()=>{const {items}=LG.importer.rowsToDataset(LG.sampleRows,{learnColumn:1});const ds={items,fileName:"Sample data",importedAt:Date.now(),encoding:"utf-8"};await LG.storage.saveDataset(ds);LG.app.setDataset(ds);LG.app.go("home")})()'); await b.wait(300);
  const sIds = await b.eval('JSON.stringify(LG.app.ctx.items.filter(i=>LG.app.ctx.kinds.get(i.id)==="sentence"&&LG.app.ctx.mcIds.has(i.id)).map(i=>i.id))');
  console.log('(c) mc eligible', await b.eval('LG.app.ctx.mcIds.size'), 'of', await b.eval('LG.app.ctx.items.length'));
  await b.eval('LG.app.go("mc",{ids:' + sIds + ',mode:"review"})'); await b.wait(300);
  for (let i = 0; i < 10; i++) {
    const opts = await b.eval('JSON.stringify([...document.querySelectorAll(".choice-text")].map(x=>x.textContent))');
    const body = await b.eval('(document.querySelector(".sentence:not(.clue)")||{}).textContent');
    console.log('  ', body, opts);
    if (!(await b.eval('(()=>{const c=document.querySelector(".choice");if(!c)return false;c.click();const n=document.querySelector(".enter-target");if(n)n.click();return true})()'))) break;
    await b.wait(150);
  }
  // (d) Daily
  await b.go(base + '?screen=daily'); await b.wait(800);
  const ans = await b.eval('(()=>{const c=LG.app.ctx;const p=LG.daily.dailyPool(c.items,c.rarity,c.langTarget,{});return LG.daily.dailyEntry(p,LG.dates.todayISO()).word})()');
  console.log('(d) mousedown prevented', await b.eval('(()=>{const k=document.querySelector(".dkey");const e=new MouseEvent("mousedown",{bubbles:true,cancelable:true});k.dispatchEvent(e);return e.defaultPrevented})()'));
  for (const ch of 'q'.repeat(Array.from(ans).length)) await b.eval('(()=>{const k=[...document.querySelectorAll(".dkey")].find(x=>x.textContent===' + JSON.stringify(ch) + ');k.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,cancelable:true}));k.click()})()');
  console.log('active element', await b.eval('document.activeElement.tagName'));
  await b.eval('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter"}))'); await b.wait(300);
  console.log('guesses after Enter', await b.eval('LG.app.state.daily.guesses.length'));
};
