// Dev-only: settings screen screenshot. Env: BASE, OUT.
module.exports = async (b) => {
  await b.go(process.env.BASE + '?sample=1'); await b.wait(800);
  await b.eval('LG.app.go("settings")'); await b.wait(500);
  console.log(await b.eval('LG.app.current'), await b.eval('document.body.innerText.slice(0,500)'));
  await b.shot(process.env.OUT, true);
};
