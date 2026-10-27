// Dev-only screenshot script for cdp.js. Env: URL (page), OUT (png path), FULL=1 (full page), WAIT (ms).
module.exports = async (b) => {
  await b.go(process.env.URL);
  await b.wait(+(process.env.WAIT || 1000));
  console.log('screen=' + await b.eval('LG.app && LG.app.current'), 'theme=' + await b.eval('document.documentElement.dataset.theme || "system"'), 'scrollW=' + await b.eval('document.documentElement.scrollWidth'));
  await b.shot(process.env.OUT, process.env.FULL === '1');
};
