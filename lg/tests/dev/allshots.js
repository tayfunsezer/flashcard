// Dev-only: screenshots of every screen. Env: OUTDIR, SUFFIX, SCREENS (comma list), THEME.
module.exports = async (b) => {
  const base = 'file:///C:/Dev/playground/game/index.html?sample=1&theme=' + process.env.THEME;
  for (const s of process.env.SCREENS.split(',')) {
    await b.go(base + (s === 'load' ? '' : s === 'home' ? '' : '&screen=' + s));
    if (s === 'load') { await b.eval('LG.app.go("load")'); await b.wait(500); }
    await b.wait(500);
    console.log(s, 'scrollW=' + await b.eval('document.documentElement.scrollWidth'), 'cur=' + await b.eval('LG.app.current'));
    await b.shot(process.env.OUTDIR + '/' + s + '-' + process.env.THEME + process.env.SUFFIX + '.png', true);
  }
};
