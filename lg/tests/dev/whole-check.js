// Dev-only: whole-expression mode in Cloze and Multiple Choice. Run: node tests/dev/cdp.js .tmp/prof-whole 1280x900 tests/dev/whole-check.js
module.exports = async (b) => {
  const ok = (c, m) => console.log((c ? 'OK ' : 'FAIL ') + m);
  await b.go('file:///C:/Dev/playground/game/index.html?sample=1'); await b.wait(1500);
  await b.eval('LG.app.setSettings({ ask: "whole" })');
  const id = await b.eval('LG.app.ctx.items.find(i=>i.target.split(" ").length>2).id');
  await b.eval('LG.app.go("cloze",{ids:[' + JSON.stringify(id) + '],mode:"review"})'); await b.wait(400);
  ok(await b.eval('document.querySelectorAll(".sentence .blank").length') === 1, 'one blank');
  const target = await b.eval('LG.app.ctx.itemsById.get(' + JSON.stringify(id) + ').target');
  ok(await b.eval('document.querySelectorAll(".sentence .word").length') === 0 && await b.eval('document.querySelector(".sentence").textContent.trim()') === '', 'no target words visible');
  const typed = target.replace(/[.,!?;:]/g, '');
  await b.eval('(()=>{const i=document.querySelector(".cloze-input");i.value=' + JSON.stringify(typed) + '})()');
  await b.click('.btn-primary.enter-target'); await b.wait(300);
  ok(await b.eval('!!document.querySelector(".fb-text-correct")'), 'typed without punctuation is correct');
  await b.eval('LG.app.go("mc",{ids:[' + JSON.stringify(id) + '],mode:"review"})'); await b.wait(400);
  ok(await b.eval('document.querySelectorAll(".choice").length') === 4, '4 choices');
  const texts = await b.eval('[...document.querySelectorAll(".choice-text")].map(e=>e.textContent)');
  ok(texts.includes(target), 'correct option equals whole target');
  console.log(b.logs.join('\n'));
};
