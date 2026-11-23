# Reset filters on load Implementation Plan

**Spec:** `docs/superpowers/specs/2026-11-23-reset-filters-on-load-design.md`

### Task 1
- Files: `js/ui/app.js`, `js/ui/screens/load.js`, `js/ui/screens/home.js`
- [ ] Add `app.resetFilters()` (in-place reset) and export it.
- [ ] Call it in load.js when `fresh`, before `setDataset`.
- [ ] Home "Clear filters" uses it.
- [ ] Run `node tests/run-node.js` (no regressions); check in browser.
