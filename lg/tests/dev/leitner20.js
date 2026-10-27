// Dev-only: Task 20 flashcards + Leitner board walk-through with real mouse/keys. Env: BASE, OUT, THEME, FULL=1 for the whole flow.
module.exports = async (b) => {
  const at = async (sel, text) => b.eval('(()=>{const el=[...document.querySelectorAll(' + JSON.stringify(sel) + ')].find(x=>x.textContent.includes(' + JSON.stringify(text) + '));if(!el)return null;el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,disabled:!!el.disabled}})()');
  const press = async (sel, text) => { const p = await at(sel, text); if (!p) { console.log('MISSING', sel, text); return false; } await b.wait(100); await b.mouse(p.x, p.y); await b.wait(400); return !p.disabled; };
  const h1 = () => b.eval('document.querySelector("h1") && document.querySelector("h1").textContent');
  const pos = () => b.eval('(document.querySelector(".game-head .muted")||{}).textContent');
  const board = () => b.eval('[...document.querySelectorAll(".lb-tile")].map(t=>t.querySelector(".lb-name").textContent+" = "+t.querySelector(".lb-meta").textContent).join(" | ")');
  const noHScroll = () => b.eval('document.documentElement.scrollWidth <= window.innerWidth');
  const out = process.env.OUT;

  await b.go(process.env.BASE + '?' + (process.env.THEME ? 'theme=' + process.env.THEME + '&' : '') + 'sample=1'); await b.wait(800);
  console.log('home games:', await b.eval('[...document.querySelectorAll(".game strong")].map(x=>x.textContent).join(", ")'));
  await b.shot(out + '-home.png', true);
  await press('button', 'Leitner boxes');
  console.log('board fresh:', await h1(), '|', await board(), '| hscroll ok', await noHScroll());
  console.log('due button:', await b.eval('(()=>{const x=document.querySelector(".leitner .btn-primary");return x.textContent+" disabled="+x.disabled})()'));
  await press('button', 'Back');

  await press('.game', 'Flashcards');
  console.log('screen:', await h1(), await pos(), 'front:', await b.eval('document.querySelector(".fc-front").textContent + " lang=" + document.querySelector(".fc-front").lang'));
  console.log('grades before flip:', await b.eval('!!document.querySelector(".fc-grades")'));
  await b.key('2'); await b.wait(150);
  console.log('2 before flip ignored, pos', await pos());
  await b.shot(out + '-fc-front.png');
  await b.key(' '); await b.wait(300);
  console.log('flipped:', await b.eval('document.querySelector(".fc-card").classList.contains("fc-flipped") + " back=" + document.querySelector(".fc-back").textContent + " lang=" + document.querySelector(".fc-back").lang'), 'hscroll ok', await noHScroll());
  await b.shot(out + '-fc-flipped.png');
  await b.key(' '); await b.wait(200);
  console.log('space after flip keeps card, pos', await pos());
  if (!process.env.FULL) return;

  const missed = [];
  for (let i = 0; i < 10; i++) {
    if (await h1() !== 'Flashcards') break;
    if (i > 0) { if (i === 1) await press('button', 'Show answer'); else if (i === 2) { const p = await at('.fc-card', ''); await b.mouse(p.x, p.y); await b.wait(200); } else { await b.key(' '); await b.wait(200); } }
    const id = await b.eval('LG.app.state && Object.keys(LG.app.state.progress).length');
    const know = i < 7;
    if (!know) missed.push(await b.eval('document.querySelector(".fc-front").textContent'));
    if (i === 3) await press('button', 'Knew it'); else await b.key(know ? '2' : '1');
    await b.wait(200);
    void id;
  }
  console.log('after round:', await h1(), '|', await b.eval('document.querySelector(".counts").innerText.split(String.fromCharCode(10)).join(" ")'));
  console.log('summary buttons:', await b.eval('[...document.querySelectorAll(".btn-row .btn")].map(x=>x.textContent).join(", ")'));
  console.log('revenge pile:', await b.eval('LG.schedule.revengeIds(LG.app.ctx.items.map(i=>i.id), LG.app.state.progress).length'), 'missed', missed.join(' / '));
  await press('button', 'Home');
  console.log('home stats:', await b.eval('document.querySelector(".stats").innerText.split(String.fromCharCode(10)).join(" ")'));
  await press('button', 'Leitner boxes');
  console.log('board after:', await board());
  console.log('due button:', await b.eval('document.querySelector(".leitner .btn-primary").textContent'));
  await b.shot(out + '-board.png', true);

  await press('button', 'Study due cards');
  console.log('due round:', await h1(), await pos());
  for (let i = 0; i < 20 && await h1() === 'Flashcards'; i++) { await b.key(' '); await b.wait(150); await b.key('2'); await b.wait(200); }
  console.log('summary:', await h1(), '| buttons:', await b.eval('[...document.querySelectorAll(".btn-row .btn")].map(x=>x.textContent).join(", ")'));
  await press('button', 'Back to Leitner boxes');
  console.log('back on:', await h1(), '|', await board());

  await press('.lb-tile', 'Box 1');
  console.log('chooser:', await b.eval('(document.querySelector(".lb-choose")||{}).innerText'));
  await b.shot(out + '-chooser.png', true);
  let ok = await press('.lb-choose button', 'Cloze');
  if (!ok) { console.log('Box 1 Cloze disabled; trying New'); await press('.lb-tile', 'New'); ok = await press('.lb-choose button', 'Cloze'); }
  console.log('cloze round:', await h1(), await pos());
  await press('button', 'Show answer'); await b.wait(200);
  console.log('after show answer:', await b.eval('document.querySelector(".fb-msg") && document.querySelector(".fb-msg").textContent'));
  console.log('mode:', await b.eval('LG.app.current'));
};
