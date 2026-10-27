// Dev-only: Task 22 JSON quiz import check. Env: BASE (file url of index.html), OUT (screenshot prefix).
const path = require('path');
module.exports = async (b) => {
  const base = process.env.BASE; const out = process.env.OUT || '.tmp/t22/shot';
  const clickText = (t) => b.eval('(()=>{const el=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()===' + JSON.stringify(t) + ');if(!el)return false;el.click();return true})()');
  const setLang = (i, v) => b.eval('(()=>{const s=document.querySelectorAll("select")[' + i + '];s.value=' + JSON.stringify(v) + ';s.dispatchEvent(new Event("change"))})()');
  await b.go(base); await b.wait(500);
  b.nextFile = path.resolve('.tmp/t22/quiz-test-9.json'); await clickText('Choose file'); await b.wait(1200);
  console.log('segmented', await b.eval('document.querySelectorAll(".segmented").length'));
  console.log('preview', await b.eval('JSON.stringify([...document.querySelectorAll(".preview thead th,.preview tbody tr")].map(r=>r.textContent))'));
  console.log('summary', await b.eval('JSON.stringify([...document.querySelectorAll("dt")].map((t,i)=>t.textContent+"="+document.querySelectorAll("dd")[i].textContent))'));
  await b.shot(out + '-load.png', true);
  await setLang(0, 'pl'); await setLang(1, 'en');
  await clickText('Start'); await b.wait(600);
  console.log('items', await b.eval('JSON.stringify(LG.app.ctx.items.map(i=>[i.target,i.categories,i.options&&i.options.length]))'));
  console.log('mcIds', await b.eval('LG.app.ctx.mcIds.size'), 'settings', await b.eval('JSON.stringify(LG.app.state.settings)'));
  await b.eval('LG.app.go("mc",{ids:LG.app.ctx.items.map(i=>i.id),mode:"review"})'); await b.wait(500);
  for (let n = 0; n < 8; n++) {
    const q = await b.eval('JSON.stringify({p:document.querySelector(".card.mc").innerText,o:[...document.querySelectorAll(".choice-text")].map(x=>x.textContent)})');
    console.log('MC', q);
    if (n === 3) await b.shot(out + '-mc.png', true);
    const ok = await b.eval('!!document.querySelector(".choice")');
    if (!ok) break;
    await b.key('1'); await b.wait(150); await b.key('Enter'); await b.wait(250);
  }
  for (const g of ['flashcards', 'cloze']) {
    await b.eval('LG.app.go(' + JSON.stringify(g) + ',{ids:LG.play.eligibleIds(LG.app.ctx.items,' + JSON.stringify(g) + ',"pl",LG.app.ctx.mcIds),mode:"review"})'); await b.wait(500);
    console.log(g, await b.eval('document.body.innerText.slice(0,200).split(String.fromCharCode(10)).join(" | ")'));
    await b.shot(out + '-' + g + '.png', true);
  }
  await b.eval('LG.app.go("leitner")'); await b.wait(500);
  console.log('leitner', await b.eval('document.body.innerText.slice(0,250).split(String.fromCharCode(10)).join(" | ")'));
  await b.shot(out + '-leitner.png', true);
};
