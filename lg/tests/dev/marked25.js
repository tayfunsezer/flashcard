// Dev-only: Task 25 practise missed + marked words, Marked words mode. Env: BASE, OUT, THEME.
module.exports = async (b) => {
  const at = async (sel, text) => b.eval('(()=>{const el=[...document.querySelectorAll(' + JSON.stringify(sel) + ')].find(x=>x.textContent.includes(' + JSON.stringify(text) + '));if(!el)return null;el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  const press = async (sel, text) => { const p = await at(sel, text); if (!p) { console.log('MISSING', sel, text); return false; } await b.wait(100); await b.mouse(p.x, p.y); await b.wait(400); return true; };
  const hscroll = () => b.eval('document.documentElement.scrollWidth > document.documentElement.clientWidth');
  const out = process.env.OUT;
  const url = process.env.BASE + '?' + (process.env.THEME ? 'theme=' + process.env.THEME + '&' : '') + 'sample=1';
  const expected = () => b.eval('(()=>{const c=document.querySelector(".clue").textContent;const it=LG.app.ctx.items.find(x=>x.source===c);return LG.words.pickBlanks(it,LG.app.state.progress[it.id],LG.app.ctx.rarity,LG.app.ctx.langTarget).map(x=>x.text).join(" ")})()');
  const markWords = async (n) => { for (let i = 0; i < n; i++) { const p = await b.eval('(()=>{const el=[...document.querySelectorAll(".word:not(.word-pinned)")][0];el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()'); await b.mouse(p.x, p.y); await b.wait(150); } };
  const pinned = () => b.eval('JSON.stringify(Object.entries(LG.app.state.progress).filter(([k,v])=>v.pin).map(([k,v])=>k+":"+v.pin))');
  const home = async (mode) => {
    await b.eval('LG.app.go("home")'); await b.wait(300);
    await press('label', mode); await b.wait(200);
  };

  await b.go(url); await b.wait(1500);
  const ids = await b.eval('LG.app.ctx.items.filter(i=>i.target.split(" ").length>3).slice(0,4).map(i=>i.id)');
  await b.eval('LG.app.go("cloze",{ids:' + JSON.stringify(ids.slice(0, 3)) + ',mode:"review"})'); await b.wait(400);
  // item 1: right + mark 2 words
  await b.eval('(()=>{const i=document.querySelector(".cloze-input");i.focus()})()');
  const e1 = await expected();
  await b.eval('(()=>{const i=document.querySelector(".cloze-input");i.value=' + JSON.stringify(e1) + '})()');
  await press('button', 'Submit'); await markWords(2); await press('button', 'Next');
  // item 2: wrong + mark 1
  await press('button', 'Show answer'); await markWords(1); await press('button', 'Next');
  // item 3: wrong, no mark
  await press('button', 'Show answer'); await press('button', 'Next');
  // missed words return at the end of the round: give up on them again
  for (let k = 0; k < 6 && (await b.eval('document.querySelector("h1").textContent')) === 'Cloze'; k++) { await press('button', 'Show answer'); await press('button', 'Next'); }
  console.log('h1:', await b.eval('document.querySelector("h1").textContent'));
  console.log('pinned:', await pinned());
  console.log('buttons:', await b.eval('[...document.querySelectorAll(".summary-actions .btn")].map(x=>x.textContent).join(" | ")'));
  console.log('hscroll summary:', await hscroll());
  await b.shot(out + '-summary.png', true);
  await press('button', 'Practice 3 words');
  console.log('practice game:', await b.eval('document.querySelector("h1").textContent'), await b.eval('(document.querySelector(".game-head .muted")||{}).textContent'));

  await home('Marked words');
  console.log('note:', await b.eval('document.querySelector(".mode-note").textContent'));
  console.log('stats:', await b.eval('document.querySelector(".stats").textContent'));
  console.log('games:', await b.eval('[...document.querySelectorAll(".game")].map(g=>g.querySelector("strong").textContent+": "+g.querySelector(".game-reason").textContent).join(" | ")'));
  console.log('hscroll home:', await hscroll());
  await b.shot(out + '-home.png', true);
  await press('.game', 'Cloze');
  const seen = [];
  for (let i = 0; i < 2; i++) {
    seen.push(await b.eval('document.querySelector(".clue").textContent + " blanks=" + document.querySelectorAll(".blank").length'));
    await press('button', 'Show answer');
    if (i === 0) {
      // unmark one with the clear button
      { const p = await b.eval('(()=>{const el=document.querySelector("[aria-label=\\"Clear pinned words\\"]");const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()'); await b.mouse(p.x, p.y); await b.wait(300); }
    }
    await press('button', 'Next');
  }
  console.log('cloze marked items:', JSON.stringify(seen), await b.eval('document.querySelector("h1").textContent'));
  await home('Marked words');
  console.log('note after unmark:', await b.eval('document.querySelector(".mode-note").textContent'));
  await press('.game', 'Flashcards');
  console.log('flashcards:', await b.eval('document.querySelector("h1").textContent'), await b.eval('(document.querySelector(".game-head .muted")||{}).textContent'));
  // clear all marks
  await b.eval('LG.app.setState(Object.assign({},LG.app.state,{progress:Object.fromEntries(Object.entries(LG.app.state.progress).map(([k,v])=>[k,Object.assign({},v,{pin:null})]))}))');
  await home('Marked words');
  console.log('empty:', await b.eval('document.querySelector(".empty-pile").textContent'));
  console.log('hscroll empty:', await hscroll());
  await b.shot(out + '-empty.png', true);
  await press('button', 'Switch to Review');
  console.log('after switch:', await b.eval('document.querySelector(".mode-note").textContent'));
  console.log('logs:', JSON.stringify(b.logs));
};
