// Dev-only: Task 23 uncapped shuffled rounds, Cloze/Match on every item, practise in the same game.
// Env: BASE, OUT, THEME, PART=fc|shuffle|cloze|match|leitner|practice|home.
module.exports = async (b) => {
  const at = async (sel, text) => b.eval('(()=>{const el=[...document.querySelectorAll(' + JSON.stringify(sel) + ')].find(x=>x.textContent.includes(' + JSON.stringify(text) + '));if(!el)return null;el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  const press = async (sel, text) => { const p = await at(sel, text); if (!p) { console.log('MISSING', sel, text); return false; } await b.wait(100); await b.mouse(p.x, p.y); await b.wait(400); return true; };
  const h1 = () => b.eval('document.querySelector("h1") && document.querySelector("h1").textContent');
  const pos = () => b.eval('(document.querySelector(".game-head .muted")||{}).textContent');
  const buttons = () => b.eval('[...document.querySelectorAll(".btn-row .btn")].map(x=>x.textContent+(x.classList.contains("btn-primary")?"*":"")).join(", ")');
  const hscroll = () => b.eval('document.documentElement.scrollWidth > document.documentElement.clientWidth');
  const out = process.env.OUT;
  const part = process.env.PART || 'fc';
  const url = process.env.BASE + '?' + (process.env.THEME ? 'theme=' + process.env.THEME + '&' : '') + 'sample=1';
  // Solve the current Match board by clicking matching tiles (optionally one wrong pair first).
  const solveBoard = async (missFirst) => {
    const n = await b.eval('document.querySelectorAll(".match-col")[0].children.length');
    const tile = (side, i) => b.eval('(()=>{const el=document.querySelectorAll(".match-col")[' + side + '].children[' + i + '];el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,t:el.textContent}})()');
    const pairOf = (i) => b.eval('(()=>{const s2t=LG.app.state.settings.direction!=="t2s";const L=document.querySelectorAll(".match-col")[0].children[' + i + '].textContent;const it=LG.app.ctx.items.find(x=>(s2t?x.source:x.target)===L);const R=s2t?it.target:it.source;return [...document.querySelectorAll(".match-col")[1].children].findIndex(e=>e.textContent===R)})()');
    if (missFirst && n > 1) {
      const j = await pairOf(0);
      const p = await tile(0, 0); await b.mouse(p.x, p.y); await b.wait(80);
      const q = await tile(1, j === 0 ? 1 : 0); await b.mouse(q.x, q.y); await b.wait(600);
    }
    for (let i = 0; i < n; i++) {
      const j = await pairOf(i);
      const p = await tile(0, i); await b.mouse(p.x, p.y); await b.wait(60);
      const q = await tile(1, j); await b.mouse(q.x, q.y); await b.wait(120);
    }
    await b.wait(300);
  };

  await b.go(url); await b.wait(800);

  if (part === 'home') {
    console.log('items:', await b.eval('LG.app.ctx.items.length'));
    console.log('mode note:', await b.eval('document.querySelector(".mode-note").textContent'));
    console.log('games:', await b.eval('[...document.querySelectorAll(".game")].map(g=>g.querySelector("strong").textContent+": "+g.querySelector(".game-reason").textContent+(g.disabled?" (disabled)":"")).join(" | ")'));
    console.log('hscroll:', await hscroll());
    await b.shot(out + '-home.png', true);
  }

  if (part === 'fc') {
    await press('.game', 'Flashcards');
    console.log('fc:', await h1(), await pos());
    for (let i = 0; i < 3; i++) { await b.key(' '); await b.wait(120); await b.key('2'); await b.wait(200); }
    console.log('after 3:', await pos());
    await press('button', 'Quit'); await b.wait(400);
    console.log('after quit:', await h1(), 'seen:', await b.eval('Object.values(LG.app.state.progress).filter(e=>e.seen).length'));
  }

  if (part === 'shuffle') {
    const firsts = [];
    for (let t = 0; t < 3; t++) {
      await press('.game', 'Flashcards');
      firsts.push(await b.eval('(()=>{const s=history; return null})()'));
      // Read the round order from the front texts of the first 5 cards without grading: use the tracker via the DOM.
      const ids = [];
      for (let i = 0; i < 5; i++) {
        ids.push(await b.eval('document.querySelector(".fc-front").textContent'));
        await b.key(' '); await b.wait(100); await b.key('2'); await b.wait(150);
      }
      firsts[t] = ids.join(' / ');
      await press('button', 'Quit'); await b.wait(400);
    }
    firsts.forEach((f, i) => console.log('start', i + 1, ':', f));
    console.log('differ:', new Set(firsts).size > 1);
  }

  if (part === 'cloze') {
    await press('.game', 'Cloze');
    console.log('cloze:', await pos());
    const seen = { one: null, short: null, long: 0 };
    for (let i = 0; i < 60 && await h1() === 'Cloze'; i++) {
      const info = await b.eval('(()=>{const c=document.querySelector(".clue").textContent;const it=LG.app.ctx.items.find(i=>i.source===c);const n=LG.text.tokenize(it.target,"pl").length;const bl=LG.words.pickBlank(it,LG.app.state.progress[it.id],LG.app.ctx.rarity,"pl");const line=document.querySelector(".sentence").textContent;return {c,t:it.target,n,blank:bl.text,line}})()');
      if (info.n === 1 && !seen.one) { seen.one = info; await b.shot(out + '-cloze-one.png'); }
      else if (info.n > 1 && info.n < 4 && !seen.short) { seen.short = info; await b.shot(out + '-cloze-short.png'); }
      else if (info.n >= 4) seen.long += 1;
      if (seen.one && seen.short) break;
      await b.eval('(()=>{const i=document.querySelector(".cloze-input");i.value=' + '"x"' + '})()');
      await press('button', 'Show answer'); await b.key('Enter'); await b.wait(200);
    }
    console.log('one-word:', JSON.stringify(seen.one));
    console.log('short:', JSON.stringify(seen.short));
    console.log('sentences seen:', seen.long);
  }

  if (part === 'match') {
    // All items: consecutive boards.
    await press('.game', 'Pair Match');
    console.log('match:', await h1(), await pos(), 'hscroll:', await hscroll());
    await b.shot(out + '-match-board.png', true);
    console.log('tiles:', await b.eval('[...document.querySelectorAll(".tile")].map(t=>Math.round(t.getBoundingClientRect().height)+":"+t.textContent).join(" | ")'));
    console.log('overflow tiles:', await b.eval('[...document.querySelectorAll(".tile")].filter(t=>t.scrollWidth>t.clientWidth+1).length'));
    await solveBoard(true);
    console.log('between:', await b.eval('(document.querySelector(".match-between")||{}).textContent'), 'focus:', await b.eval('document.activeElement.textContent'));
    await b.shot(out + '-match-between.png');
    await b.key('Enter'); await b.wait(400);
    let boards = 1;
    for (let k = 0; k < 40 && await h1() === "Pair Match"; k++) {
      if (await b.eval('!!document.querySelector(".match-between")')) { await b.key('Enter'); await b.wait(400); continue; }
      await solveBoard(false); boards += 1;
    }
    console.log('boards played:', boards, 'end:', await h1(), '|', await b.eval('document.querySelector(".counts").innerText.split(String.fromCharCode(10)).join(" ")'));
    console.log('summary buttons:', await buttons());
    await b.shot(out + '-match-summary.png', true);
    // Filter with 3 items.
    await press('button', 'Home');
    const cat = await b.eval('(()=>{const o=LG.words.groupOptions(LG.app.ctx.items).categories;const ids=LG.app.ctx.items.slice(0,3).map(i=>i.id);LG.app.filters.categories=[];return o.map(c=>c.name+"="+c.count).join(",")})()');
    console.log('cats:', cat);
    await b.eval('(()=>{const d=LG.app.ctx.items.filter(i=>i.date).map(i=>i.date);LG.app.filters.dateFrom="2099-01-01";LG.app.refresh()})()');
    console.log('empty filter match:', await b.eval('[...document.querySelectorAll(".game")].find(g=>g.textContent.includes("Pair Match")).querySelector(".game-reason").textContent'));
    // Pick three ids directly via ?screen=match&ids=
    const three = await b.eval('LG.app.ctx.items.filter(i=>LG.words.kindOf(i.target,"pl")==="sentence").slice(0,3).map(i=>i.id).join(",")');
    await b.go(url + '&screen=match&ids=' + three); await b.wait(600);
    console.log('three:', await pos(), 'boards label:', await b.eval('[...document.querySelectorAll(".game-head .muted")].map(x=>x.textContent).join(" ")'), 'hscroll:', await hscroll());
    await b.shot(out + '-match-three.png', true);
    await solveBoard(false);
    console.log('three end:', await h1());
  }

  if (part === 'leitner') {
    // Make every item seen and due.
    await b.eval('(()=>{const p={};for(const it of LG.app.ctx.items)p[it.id]={box:1,due:0,revenge:false,seen:true,pin:null,rot:0};LG.app.setState(Object.assign({},LG.app.state,{progress:p}));LG.app.go("leitner")})()');
    await b.wait(400);
    console.log('study due:', await b.eval('[...document.querySelectorAll("button")].find(x=>x.textContent.startsWith("Study due")).textContent'));
    await press('button', 'Study due cards');
    console.log('fc:', await h1(), await pos());
    await press('.lb-tile, button', 'Quit');
    await b.eval('LG.app.go("leitner")'); await b.wait(300);
    await press('.lb-tile', 'Box 1');
    console.log('chooser:', await b.eval('document.querySelector(".lb-choose").innerText.split(String.fromCharCode(10)).join(" | ")'));
  }

  if (part === 'practice') {
    await press('.game', 'Cloze');
    const total = Number((await pos()).split('/')[1].trim().split(' ')[0]);
    console.log('cloze total:', total);
    // Miss the first 2, answer the rest right.
    for (let i = 0; i < total + 5 && await h1() === 'Cloze'; i++) {
      const ans = await b.eval('(()=>{const c=document.querySelector(".clue").textContent;const it=LG.app.ctx.items.find(i=>i.source===c);return LG.words.pickBlank(it,LG.app.state.progress[it.id],LG.app.ctx.rarity,"pl").text})()');
      const again = await b.eval('!!document.querySelector(".again-tag")');
      if (i < 2) { await press('button', 'Show answer'); }
      else { await b.eval('document.querySelector(".cloze-input").value=' + JSON.stringify(ans)); await b.key('Enter'); await b.wait(150); }
      await b.key('Enter'); await b.wait(150);
      if (again && i > 50) break;
    }
    console.log('summary:', await h1(), '| buttons:', await buttons());
    await b.shot(out + '-summary.png', true);
    await press('button', 'Practice the');
    console.log('practice ->', await h1(), await pos());
    for (let i = 0; i < 20 && await h1() === 'Cloze'; i++) { await press('button', 'Show answer'); await b.key('Enter'); await b.wait(150); }
    console.log('practice summary:', await h1(), '| buttons:', await buttons());
    await press('button', 'Practice them as Flashcards');
    console.log('as flashcards ->', await h1(), await pos());
  }
};
