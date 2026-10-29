// Dev-only: Task 24 cloze "You typed" line and multi-word expressions. Env: BASE, OUT, THEME.
module.exports = async (b) => {
  const out = process.env.OUT;
  const q = (js) => b.eval(js);
  const pt = (sel, text) => q('(()=>{const el=[...document.querySelectorAll(' + JSON.stringify(sel) + ')].find(x=>x.textContent.includes(' + JSON.stringify(text) + '));if(!el)return null;el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  const press = async (sel, text) => { const p = await pt(sel, text); if (!p) { console.log('MISSING', sel, text); return; } await b.mouse(p.x, p.y); await b.wait(300); };
  const type = async (s) => { await q('(()=>{const i=document.querySelector(".cloze-input");i.value=' + JSON.stringify(s) + ';})()'); };
  const text = (sel) => q('(document.querySelector(' + JSON.stringify(sel) + ')||{}).textContent');
  await b.go(process.env.BASE + '?' + (process.env.THEME ? 'theme=' + process.env.THEME + '&' : '') + 'sample=1'); await b.wait(800);
  await q('(()=>{const it=LG.app.ctx.items.find(x=>x.target.startsWith("Mała dziew"));LG.app.go("cloze",{ids:[it.id],mode:"review"})})()'); await b.wait(500);
  console.log('h1:', await text('h1'));
  // Wrong answer
  await type('zzz'); await press('button', 'Submit');
  console.log('msg:', await text('.fb-msg'));
  console.log('typed:', await text('.typed'), '| deco:', await q('(()=>{const s=document.querySelector(".typed-wrong");return s&&getComputedStyle(s).textDecorationLine})()'));
  console.log('pin row before:', await text('.pin-row'));
  await b.shot(out + '-typed.png');
  // Pin first and last words of the sentence (non-adjacent)
  const words = await q('[...document.querySelectorAll(".sentence .word")].map(x=>x.textContent)');
  console.log('words:', JSON.stringify(words));
  const last = words[2], first = words[0];
  await press('.sentence .word', last); await press('.sentence .word', first);
  console.log('pin row:', await text('.pin-row'));
  const id = await q('(()=>{const e=LG.app.state.progress;return Object.keys(e).find(k=>e[k].pin)})()');
  console.log('stored pin:', await q('JSON.stringify(LG.app.state.progress[' + JSON.stringify(id) + '].pin)'));
  // adjacent label check: pin the 2nd word too -> first two adjacent
  await press('.sentence .word', words[1]);
  console.log('pin row 3:', await text('.pin-row'));
  await press('.sentence .word', words[1]);
  await b.shot(out + '-pins.png');
  // Replay the item with two blanks
  await q('LG.app.go("cloze",{ids:[' + JSON.stringify(id) + '],mode:"review"})'); await b.wait(500);
  console.log('blanks:', await q('document.querySelectorAll(".sentence .blank").length'), '| note:', await text('.multi-note'));
  const exp = await q('(()=>{const it=LG.app.ctx.itemsById.get(' + JSON.stringify(id) + ');const bl=LG.words.pickBlanks(it,LG.app.state.progress[' + JSON.stringify(id) + '],LG.app.ctx.rarity,LG.app.ctx.langTarget);return bl.map(x=>x.text).join(" ")})()');
  console.log('expected:', exp);
  await press('button', 'Hint'); await press('button', 'Hint');
  console.log('hint:', JSON.stringify(await text('.hint')));
  await b.shot(out + '-twoblank.png');
  // diacritic-free typing -> almost
  const plain = exp.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
  await type(plain); await press('button', 'Submit');
  console.log('plain', JSON.stringify(plain), '->', await text('.fb-msg'), '|', await text('.typed'));
  await b.shot(out + '-almost.png');
  // correct typing on a fresh round
  await q('LG.app.go("cloze",{ids:[' + JSON.stringify(id) + '],mode:"review"})'); await b.wait(400);
  await type(exp.toUpperCase().replace(' ', '   ')); await press('button', 'Submit');
  console.log('correct ->', await text('.fb-msg'), '| typed line:', await text('.typed'));
  console.log('hscroll:', await q('document.documentElement.scrollWidth > document.documentElement.clientWidth'));
};
