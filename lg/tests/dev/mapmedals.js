// Dev-only: seed progress so the map shows all medals, then screenshot. Env: THEME, OUT.
module.exports = async (b) => {
  await b.go('file:///C:/Dev/playground/game/index.html?sample=1&theme=' + process.env.THEME + '&screen=map');
  await b.eval(`(() => { const a = LG.app, p = {}; const by = {};
    a.ctx.items.forEach(i => i.categories.forEach(c => (by[c] = by[c] || []).push(i.id)));
    const cats = Object.keys(by); const shares = [0.95, 0.65, 0.35, 0.1];
    cats.forEach((c, k) => by[c].forEach((id, j) => { p[id] = { box: j < by[c].length * shares[k] ? 4 : 1, revenge: j === 0 }; }));
    a.setState(Object.assign({}, a.state, { progress: p })); a.go('map'); })()`);
  await b.wait(400);
  await b.shot(process.env.OUT, true);
};
