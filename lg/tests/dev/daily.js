// Dev-only: daily word flow. Env: BASE (file url of index.html), THEME, TAG.
module.exports = async (b) => {
  const base = process.env.BASE, th = process.env.THEME || 'light', tag = process.env.TAG || th;
  const url = base + '?sample=1&screen=daily&theme=' + th;
  const typeWord = async (w) => { for (const ch of w) await b.eval('document.dispatchEvent(new KeyboardEvent("keydown",{key:' + JSON.stringify(ch) + '}))'); };
  const enter = () => b.eval('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter"}))');
  await b.go(url); await b.wait(800);
  const ans = await b.eval('(()=>{const c=LG.app.ctx;const p=LG.daily.dailyPool(c.items,c.rarity,c.langTarget,{});return LG.daily.dailyEntry(p,LG.dates.todayISO()).word})()');
  console.log('answer', ans, 'scrollW', await b.eval('document.documentElement.scrollWidth'), 'inner', await b.eval('innerWidth'));
  await typeWord('ab'); await enter();
  console.log('msg', await b.eval('document.querySelector(".daily-msg").textContent'));
  await b.shot('.tmp/daily-' + tag + '-short.png');
  const n = Array.from(ans).length;
  for (let i = 0; i < 3; i++) { await typeWord('Q'.repeat(n)); await enter(); }
  console.log('hint', await b.eval('(document.querySelector(".daily-hint")||{}).textContent'));
  await b.shot('.tmp/daily-' + tag + '-hint.png');
  await b.go(url); await b.wait(800);
  console.log('after reload rows filled', await b.eval('document.querySelectorAll(".dtile-grey,.dtile-yellow,.dtile-green").length'), 'guesses', await b.eval('LG.app.state.daily.guesses.length'));
  await typeWord(ans.toUpperCase()); await enter();
  await b.wait(300);
  console.log('done', await b.eval('JSON.stringify([LG.app.state.daily.done,LG.app.state.daily.won,LG.app.state.xp,LG.app.state.streak])'));
  await b.shot('.tmp/daily-' + tag + '-won.png');
  await b.go(url); await b.wait(800);
  console.log('revisit keys', await b.eval('document.querySelectorAll(".dkey").length'), 'scrollW', await b.eval('document.documentElement.scrollWidth'));
  await b.shot('.tmp/daily-' + tag + '-revisit.png');
  await b.go(base + '?sample=1'); await b.wait(800);
  console.log('home', await b.eval('Array.from(document.querySelectorAll(".card")).map(c=>c.textContent).filter(t=>/word/i.test(t)).join("|")'));
};
