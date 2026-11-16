// Dev-only: star buttons, summary word list, Play all marked. Run: node tests/dev/cdp.js .tmp/prof-star 1280x900 tests/dev/star-check.js
const path = require('path');
const { pathToFileURL } = require('url');
module.exports = async (b) => {
  const ok = (c, m) => console.log((c ? 'OK ' : 'FAIL ') + m);
  await b.go(pathToFileURL(path.resolve(__dirname, '../../index.html')).href + '?sample=1'); await b.wait(1500);
  const ids = await b.eval('JSON.stringify(LG.app.ctx.items.slice(0,5).map(i=>i.id))');
  await b.eval('LG.app.go("mc",{ids:' + ids + ',mode:"review"})'); await b.wait(400);
  await b.eval('document.querySelector(".choice").click()'); await b.wait(300);
  ok(await b.eval('document.querySelector(".star-btn").textContent') === '☆ Mark', 'star shows Mark');
  await b.eval('document.querySelector(".star-btn").click()'); await b.wait(200);
  ok(await b.eval('document.querySelector(".star-btn").textContent') === '★ Marked', 'label becomes Marked');
  ok(await b.eval('document.querySelector(".star-btn").getAttribute("aria-pressed")') === 'true', 'aria-pressed true');
  for (let i = 0; i < 40 && await b.eval('LG.app.current') === 'mc'; i++) {
    await b.eval('document.querySelector(".enter-target").click()'); await b.wait(250);
    if (await b.eval('!!document.querySelector(".choice:not([disabled])")')) { await b.eval('document.querySelector(".choice").click()'); await b.wait(250); }
  }
  const btns = await b.eval('JSON.stringify([...document.querySelectorAll(".summary-actions .btn")].map(e=>e.textContent))');
  ok(btns.includes('Play all marked (1)'), 'summary shows Play all marked (1): ' + btns);
  ok(await b.eval('document.querySelector(".words-card summary").textContent') === 'Words in this round (5)', 'word list of 5');
  await b.eval('[...document.querySelectorAll(".summary-actions .btn")].find(e=>e.textContent==="Play all marked (1)").click()'); await b.wait(400);
  ok(await b.eval('LG.app.current') === 'mc' && await b.eval('document.querySelectorAll(".choice").length') === 4, 'screen is mc');
  ok(await b.eval('document.querySelector(".game-head .muted").textContent') + '' === '0 / 1 done', 'one prompt: ' + await b.eval('document.querySelector(".game-head").textContent'));
  await b.eval('LG.app.go("home")'); await b.wait(400);
  await b.eval('document.querySelector("input[value=marked]").click()'); await b.wait(300);
  const txt = await b.eval('document.body.textContent');
  ok(txt.includes('items you starred — 1 right now'), 'home note says 1 right now');
  // Cloze: pinning a word in feedback flips the star label.
  await b.eval('LG.app.go("cloze",{ids:LG.app.reviewRound("cloze",LG.app.ctx.items.map(i=>i.id)).slice(0,1),mode:"review"})'); await b.wait(400);
  await b.eval('document.querySelector(".btn-link").click()'); await b.wait(300);
  ok(await b.eval('document.querySelector(".star-btn").textContent') === '☆ Mark', 'cloze star starts unmarked');
  await b.eval('document.querySelector(".sentence .word").click()'); await b.wait(200);
  ok(await b.eval('document.querySelector(".star-btn").textContent') === '★ Marked', 'cloze star flips to Marked after pinning a word');
  ok(await b.eval('document.querySelector(".star-btn").getAttribute("aria-pressed")') === 'true', 'cloze aria-pressed true');
  console.log(b.logs.join('\n'));
};
