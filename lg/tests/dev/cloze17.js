// Dev-only: ?sample=1 Cloze + settings + load-screen screenshots. Env: BASE, OUT, THEME.
module.exports = async (b) => {
  const click = (t) => b.eval('(()=>{const el=[...document.querySelectorAll("button")].find(x=>x.textContent.trim().startsWith(' + JSON.stringify(t) + '));if(!el)return false;el.click();return true})()');
  await b.go(process.env.BASE + '?' + (process.env.THEME ? 'theme=' + process.env.THEME + '&' : '') + 'sample=1'); await b.wait(800);
  await click('Cloze'); await b.wait(800);
  console.log('cloze', await b.eval('document.body.innerText.slice(0,260)'));
  await b.eval('LG.app.go("home")'); await b.wait(300);
  await click('Settings'); await b.wait(400);
  console.log('settings', await b.eval('document.body.innerText.slice(0,300)'));
  await b.shot(process.env.OUT + '-settings.png', true);
  await b.eval('LG.app.go("home")'); await b.wait(300);
  await click('Load new file'); await b.wait(400);
  await click('Try with sample data'); await b.wait(500);
  await b.shot(process.env.OUT + '-load.png', true);
};
