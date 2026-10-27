(function (g) {
  const tests = [];
  function isObj(x) { return x !== null && typeof x === 'object'; }
  function deepEq(a, b) {
    if (Object.is(a, b)) return true;
    if (!isObj(a) || !isObj(b)) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEq(a[k], b[k]));
  }
  const T = {
    test(name, fn) { tests.push({ name, fn }); },
    eq(actual, expected, msg) {
      if (!deepEq(actual, expected)) {
        throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
      }
    },
    ok(cond, msg) { if (!cond) throw new Error(msg || 'expected truthy value'); },
    throws(fn, msg) {
      let threw = false;
      try { fn(); } catch (e) { threw = true; }
      if (!threw) throw new Error(msg || 'expected function to throw');
    },
    run() {
      const result = { passed: 0, failed: 0, failures: [] };
      const results = [];
      for (const t of tests) {
        try { t.fn(); result.passed++; results.push({ name: t.name }); }
        catch (error) { result.failed++; result.failures.push({ name: t.name, error }); results.push({ name: t.name, error }); }
      }
      result.results = results;
      return result;
    },
  };
  g.T = T;
})(globalThis);
