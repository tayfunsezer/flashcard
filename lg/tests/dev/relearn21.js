// Dev-only: Task 21 in-round relearning + "Practice the words you missed". Env: BASE, OUT, THEME, PART=fc|cloze|mc|study.
module.exports = async (b) => {
  const at = async (sel, text) => b.eval('(()=>{const el=[...document.querySelectorAll(' + JSON.stringify(sel) + ')].find(x=>x.textContent.includes(' + JSON.stringify(text) + '));if(!el)return null;el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  const press = async (sel, text) => { const p = await at(sel, text); if (!p) { console.log('MISSING', sel, text); return false; } await b.wait(100); await b.mouse(p.x, p.y); await b.wait(400); return true; };
  const h1 = () => b.eval('document.querySelector("h1") && document.querySelector("h1").textContent');
  const pos = () => b.eval('(document.querySelector(".game-head .muted")||{}).textContent');
  const tag = () => b.eval('(document.querySelector(".again-tag")||{}).textContent || ""');
  const buttons = () => b.eval('[...document.querySelectorAll(".btn-row .btn")].map(x=>x.textContent+(x.classList.contains("btn-primary")?"*":"")).join(", ")');
  const counts = () => b.eval('document.querySelector(".counts").innerText.split(String.fromCharCode(10)).join(" ")');
  const out = process.env.OUT;
  const part = process.env.PART || 'fc';

  await b.go(process.env.BASE + '?' + (process.env.THEME ? 'theme=' + process.env.THEME + '&' : '') + 'sample=1'); await b.wait(800);

  if (part === 'fc') {
    await press('.game', 'Flashcards');
    const front = () => b.eval('document.querySelector(".fc-front").textContent');
    const missedWord = await front();
    console.log('card 1:', missedWord, pos && await pos(), 'tag:', JSON.stringify(await tag()));
    await b.key(' '); await b.wait(200); await b.key('1'); await b.wait(250);
    for (let i = 1; i < 10; i++) {
      console.log(' card', i + 1, await pos(), 'tag:', JSON.stringify(await tag()));
      await b.key(' '); await b.wait(150); await b.key('2'); await b.wait(250);
    }
    console.log('repeat:', await h1(), await pos(), 'front:', await front(), 'same:', (await front()) === missedWord, 'tag:', JSON.stringify(await tag()));
    console.log('xp before repeat:', await b.eval('document.querySelector(".game-head .pill:last-of-type").textContent'));
    await b.shot(out + '-repeat.png');
    await b.key(' '); await b.wait(200);
    await b.shot(out + '-repeat-flipped.png');
    await b.key('2'); await b.wait(500);
    console.log('after repeat:', await h1(), '|', await counts());
    console.log('summary buttons:', await buttons(), '| focused:', await b.eval('document.activeElement.textContent'));
    await b.shot(out + '-summary.png', true);
    const id = await b.eval('LG.app.ctx.items.find(i=>i.source===' + JSON.stringify(missedWord) + ' || i.target===' + JSON.stringify(missedWord) + ').id');
    console.log('missed word box:', await b.eval('LG.app.state.progress[' + JSON.stringify(id) + '].box'));
    if (process.env.BOARD) {
      await press('button', 'Home');
      await press('button', 'Leitner boxes');
      console.log('board:', await b.eval('[...document.querySelectorAll(".lb-tile")].map(t=>t.querySelector(".lb-name").textContent+" = "+t.querySelector(".lb-meta").textContent).join(" | ")'));
      return;
    }
    await press('button', 'Practice the');
    console.log('practice:', await h1(), await pos(), 'front:', await front(), 'same:', (await front()) === missedWord, 'tag:', JSON.stringify(await tag()));
    await b.key(' '); await b.wait(150); await b.key('2'); await b.wait(400);
    console.log('practice summary:', await counts(), '| buttons:', await buttons());
  }

  if (part === 'cloze') {
    await press('.game', 'Cloze');
    const clue = () => b.eval('document.querySelector(".clue").textContent');
    const expected = () => b.eval('(()=>{const c=document.querySelector(".clue").textContent;const it=LG.app.ctx.items.find(i=>i.source===c);return LG.words.pickBlank(it,LG.app.state.progress[it.id],LG.app.ctx.rarity,LG.app.ctx.langTarget).text})()');
    const firstClue = await clue();
    console.log('first:', firstClue, await pos());
    await press('button', 'Show answer');
    const missedAnswer = await b.eval('document.querySelector(".fb-msg strong").textContent');
    console.log('missed answer:', missedAnswer, 'rot now:', await b.eval('(()=>{const it=LG.app.ctx.items.find(i=>i.source===' + JSON.stringify(firstClue) + ');return LG.app.state.progress[it.id].rot})()'));
    await b.key('Enter'); await b.wait(250);
    for (let i = 0; i < 20 && await h1() === 'Cloze'; i++) {
      if (await clue() === firstClue) break;
      const ans = await expected();
      await b.eval('(()=>{const x=document.querySelector(".cloze-input");x.value=' + JSON.stringify(ans) + ';})()');
      await b.key('Enter'); await b.wait(200); await b.key('Enter'); await b.wait(250);
    }
    console.log('repeat:', await clue() === firstClue, await pos(), 'tag:', JSON.stringify(await tag()), 'blank len:', await b.eval('document.querySelector(".blank").getAttribute("aria-label")'));
    await b.shot(out + '-cloze-repeat.png');
    await press('button', 'Show answer');
    const again = await b.eval('document.querySelector(".fb-msg strong").textContent');
    console.log('repeat answer:', again, 'same word:', again === missedAnswer, 'xp shown:', await b.eval('(document.querySelector(".fb-msg .muted")||{}).textContent||"none"'));
    await b.key('Enter'); await b.wait(250);
    console.log('2nd repeat:', await clue() === firstClue, await pos(), 'tag:', JSON.stringify(await tag()));
    await b.eval('(()=>{const x=document.querySelector(".cloze-input");x.value=' + JSON.stringify(missedAnswer) + ';})()');
    await b.key('Enter'); await b.wait(200);
    console.log('result:', await b.eval('document.querySelector(".fb-msg").textContent'));
    await b.key('Enter'); await b.wait(400);
    console.log('end:', await h1(), '|', await counts(), '|', await buttons());
    console.log('rot after leaving:', await b.eval('(()=>{const it=LG.app.ctx.items.find(i=>i.source===' + JSON.stringify(firstClue) + ');return LG.app.state.progress[it.id].rot})()'));
  }

  if (part === 'mc') {
    await press('.game', 'Multiple Choice');
    const body = () => b.eval('document.querySelector(".mc").innerText');
    const opts = () => b.eval('[...document.querySelectorAll(".choice-text")].map(x=>x.textContent).join(" | ")');
    let missedBody = null, missedOpts = null;
    for (let i = 0; i < 60 && await h1() === 'Multiple Choice'; i++) {
      const bd = await body(), op = await opts(), tg = await tag();
      if (missedBody && bd === missedBody && tg) {
        console.log('repeat:', await pos(), 'tag:', JSON.stringify(tg));
        console.log('  first options :', missedOpts);
        console.log('  repeat options:', op, '| reshuffled:', op !== missedOpts);
        await b.shot(out + '-mc-repeat.png');
        missedBody = '#done';
      }
      await b.key('1'); await b.wait(250);
      const wrong = await b.eval('!!document.querySelector(".choice-wrong")');
      if (wrong && !missedBody && !tg) { missedBody = bd; missedOpts = op; console.log('missed first:', bd.split(String.fromCharCode(10)).join(' / '), await pos()); }
      await b.key('Enter'); await b.wait(250);
    }
    console.log('end:', await h1(), '|', await counts(), '|', await buttons());
  }

  if (part === 'study') {
    await b.eval('(()=>{const app=LG.app;const ids=LG.play.eligibleIds(app.ctx.items.slice(0,4),"flashcards",app.ctx.langTarget,app.ctx.mcIds);const set=LG.study.createStudySet({by:"category",value:"Test",game:"flashcards"},ids,Math.random);app.setState(Object.assign({},app.state,{studySet:set}));app.go("flashcards",{ids:set.queue.slice(),mode:"study"});})()');
    await b.wait(400);
    const q = () => b.eval('JSON.stringify(LG.app.state.studySet && LG.app.state.studySet.queue.length)');
    console.log('study start:', await pos(), 'queue', await q());
    await b.key(' '); await b.wait(150); await b.key('1'); await b.wait(250);
    console.log('after miss:', await pos(), 'queue', await q(), 'tag:', JSON.stringify(await tag()));
    for (let i = 0; i < 10 && await h1() === 'Flashcards'; i++) {
      console.log(' ', await pos(), 'tag:', JSON.stringify(await tag()));
      await b.key(' '); await b.wait(150); await b.key('2'); await b.wait(250);
    }
    console.log('end:', await h1(), '|', await counts(), '|', await buttons());
    await b.shot(out + '-study-summary.png', true);
  }
};
