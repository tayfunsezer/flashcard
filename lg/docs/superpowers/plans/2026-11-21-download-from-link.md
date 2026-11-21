# Download from a link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the learner paste a published table link on the Load screen, download it into the normal import flow, and have ↻ Refresh re-download from that link.

**Architecture:** A pure core module `LG.remote` (URL check, file naming, fetch with injected `fetch`) returns a file-like `{ name, arrayBuffer() }` that the existing `LG.importer.readFile` already accepts. The Load screen gets a textbox and button; the saved dataset stores `sourceUrl`; `app.refreshFile` prefers `sourceUrl` over the file handle.

**Tech Stack:** Classic scripts, IIFE modules, `fetch`, in-repo test runner (`node tests/run-node.js`).

**Spec:** `docs/superpowers/specs/2026-11-21-download-from-link-design.md`

## Global Constraints

- Classic `<script>` tags only, no ES modules, no libraries; each file is an IIFE on `LG`.
- No hardcoded link anywhere in the code.
- `index.html` and `tests/manifest.js` list core files in the same order (`remote.js` right after `importer.js`).
- Feedback through `app.banner` or the Load screen error, never `alert`.
- Mobile: input `type="url"`, `inputmode="url"`, `autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`; input and button full width at phone width, 44px minimum height, no horizontal scroll at 360px.
- No change to `lg.state` (no `VERSION` bump). Preserve each file's line endings (`css/app.css` is CRLF).
- Commits: no `Co-Authored-By` / AI attribution (lg convention). Do not commit unless the user asks.

## Review Focus

- Link with surrounding whitespace or a trailing newline (pasted on a phone): trimmed, accepted.
- Non-http(s) text (`javascript:`, `ftp:`, plain words, empty): rejected with a readable message, never fetched.
- Server returns an HTML page (a sheet `/edit` link, login wall): readable error, current data untouched.
- Non-OK HTTP status and network failure (offline): readable error; Refresh keeps the current dataset.
- Refresh on a dataset loaded from a file (no `sourceUrl`) behaves exactly as before.

---

### Task 1: `LG.remote` core module

**Files:**
- Create: `js/core/remote.js`, `tests/remote.test.js`
- Modify: `tests/manifest.js` (add `'js/core/remote.js'` after `importer.js` in `src`, `'tests/remote.test.js'` after `importer.test.js` in `tests`), `index.html` (script tag after `importer.js`), `tests/run-node.js` (add `URL` to the sandbox object)

**Interfaces:**
- Produces:
  - `LG.remote.parseUrl(text: string) → { ok: true, url: string } | { ok: false, error: string }`
  - `LG.remote.fileNameFor(url: string, contentType?: string) → string` (always ends in `.tsv|.csv|.json|.xlsx`)
  - `LG.remote.fetchFile(url: string, opts?: { fileName?: string, fetchImpl?: Function }) → Promise<{ name: string, arrayBuffer: () => Promise<ArrayBuffer> }>`; rejects with an `Error` whose message is user-readable.

- [ ] **Step 1: Write the failing tests** in `tests/remote.test.js` (IIFE style as `marked.test.js`), using a fake `fetchImpl` returning `{ ok, status, headers: { get }, arrayBuffer }`:
  - `parseUrl('  https://x.test/a?b=1\n')` → `{ ok: true, url: 'https://x.test/a?b=1' }`
  - `parseUrl('')` → error `'Paste the link first.'`; `parseUrl('javascript:alert(1)')`, `parseUrl('ftp://x/y')`, `parseUrl('hello')` → `ok:false` with error `'The link must start with https://'`; `parseUrl('http://x.test/a.csv').ok === true`
  - `fileNameFor` for the Google link (`https://docs.google.com/spreadsheets/d/e/K/pub?gid=0&single=true&output=tsv`) → `'Google Sheet.tsv'`; `https://x.test/words.csv` → `'words.csv'`; `https://x.test/pub?output=csv` → `'Word list.csv'`; `https://x.test/data` with content type `application/json` → `'Word list.json'`; no hint at all → `'Word list.csv'`
  - `fetchFile` OK path: bytes of `'a\tb\n'` come back through `file.arrayBuffer()`, `file.name === 'Google Sheet.tsv'`; with `opts.fileName: 'mine.tsv'` the name is `'mine.tsv'`
  - `fetchFile` rejects: status 404 → message contains `'404'`; content type `text/html; charset=utf-8` → message `'The link returned a web page, not a table. Use the published TSV or CSV link.'`; `fetchImpl` throwing `TypeError` → message starts `'Could not download.'`; invalid link → the `parseUrl` error; `fetchImpl` is never called for an invalid link
  - `fetchFile` passes `{ cache: 'no-store' }` to `fetchImpl` (assert on the recorded call)
- [ ] **Step 2: Run** `node tests/run-node.js` → fails (`LG.remote` undefined / manifest file missing).
- [ ] **Step 3: Implement** `js/core/remote.js` per the Interfaces. Use `new URL`. Extension choice order: query `output=tsv|csv`; path ending `.csv|.tsv|.txt|.json|.xlsx` (`.txt` maps to `csv`); content type (`tab-separated`→tsv, `csv`→csv, `json`→json, `spreadsheetml`→xlsx); else `csv`. Base name: `Google Sheet` for host `docs.google.com`; the path's last segment when it already carries the chosen extension; else `Word list`. Network errors message: `'Could not download. Check your connection, and that the link is published to the web (the host must allow browser downloads).'` Default `fetchImpl` is `globalThis.fetch`.
- [ ] **Step 4: Wire** manifest, `index.html` and `run-node.js` sandbox (`URL`). Run `node tests/run-node.js` → all pass, including the script-order check.

### Task 2: Load screen textbox and stored `sourceUrl`

**Files:**
- Modify: `js/ui/screens/load.js` (`renderPick`, `readAndShow`, `renderLanguages`, `render`), `css/app.css` (CRLF), `README.md`

**Interfaces:**
- Consumes: `LG.remote.parseUrl`, `LG.remote.fetchFile` (Task 1).
- Produces: `readAndShow(root, file, handle = null, sourceUrl = null)`; saved dataset shape gains optional `sourceUrl` (`{ items, fileName, importedAt, encoding, learnColumn, sourceUrl }`); `LG.screens.load.importFile` keeps its name and gains the 4th argument.

- [ ] **Step 1: Implement `renderPick` link row** under the dropzone buttons: a `.card.stack` with `<label class="field">` "Or paste a link to a published table", `<input type="url" class="link-input">` (mobile attributes from Global Constraints, pre-filled with `app.dataset && app.dataset.sourceUrl || ''`), a `Download` button (`.btn.btn-primary`). Click: `parseUrl` → on error re-render with `renderPick(root, error)`; otherwise disable the button, label `Downloading…`, `await LG.remote.fetchFile(url)`, then `readAndShow(root, file, null, url)`; any rejection → `renderPick(root, e.message)` (the error prefix there is "Could not read the file: "; add an optional third parameter or use `error` text that already reads well, builder's choice, but the text shown must be the rejection message). Enter in the input triggers the same action.
- [ ] **Step 2: Thread `sourceUrl`** through `readAndShow` → `renderLanguages(root, { …, sourceUrl })`; in the Start handler add `sourceUrl: opts.sourceUrl || undefined` to the fresh dataset, and keep `saveHandle(null)` for a link import (already the behaviour when `opts.handle` is null).
- [ ] **Step 3: CSS** in `css/app.css` (write with CRLF): `.link-input { width: 100%; box-sizing: border-box; min-height: 44px; }` and a `.link-row` that stacks input over button; under `@media (max-width: 480px)` the Download button is `width: 100%; min-height: 44px`. Colours from existing variables only.
- [ ] **Step 4: README** "Download from a link" section: paste the published TSV/CSV link, works on phones, the host must allow browser downloads (Google Sheets "Publish to the web" links do), ↻ re-downloads, `/edit` links are not accepted.
- [ ] **Step 5: Verify** `node tests/run-node.js` green; `git diff --stat` shows `css/app.css` with only the added lines (no line-ending churn).

### Task 3: Refresh re-downloads from `sourceUrl`

**Files:**
- Modify: `js/ui/app.js` (`refreshFile`)

**Interfaces:**
- Consumes: `LG.remote.fetchFile(url, { fileName })` (Task 1), `finishRefresh(file)` (existing), dataset `sourceUrl` (Task 2).

- [ ] **Step 1: In `refreshFile`**, after the in-game confirm and before the handle logic: if `app.dataset.sourceUrl`, `await LG.remote.fetchFile(app.dataset.sourceUrl, { fileName: app.dataset.fileName })` and `return finishRefresh(file)`. On rejection: `clearRefreshBanners()`, `banner('Could not refresh: ' + e.message, 'error')` with the existing "Load file…" button pattern, dataset untouched, no picker.
- [ ] **Step 2: Confirm** `finishRefresh` keeps `sourceUrl` on the new dataset: `LG.reload.reparse` builds a fresh dataset, so copy `sourceUrl` onto `res.dataset` in `finishRefresh` (one line) when `app.dataset.sourceUrl` is set. Add a test in `tests/reload.test.js` only if `reparse` itself changes; otherwise this is UI-level and checked in Task 4.
- [ ] **Step 3: Run** `node tests/run-node.js` → green.

### Task 4: Browser verification and docs

**Files:**
- Modify: `CLAUDE.md` (lg): layout line for `remote.js`, `sourceUrl` in the dataset shape, Refresh paragraph, test count.

- [ ] **Step 1: Serve** `python3 -m http.server 8080` in `lg/`; with Claude in Chrome open `http://localhost:8080/`. Paste the sheet link (Load screen), Download, check the import summary (273,950-char sheet loads; header skipped), Start.
- [ ] **Step 2: Refresh:** press ↻ on Home → banner "refreshed" text, no picker, `learnColumn` kept.
- [ ] **Step 3: Errors:** `hello`, empty, `https://example.com/` (HTML), a 404 URL: each shows a readable message and leaves the dataset intact. Offline case via the fetch error path.
- [ ] **Step 4: `file://`:** open `lg/index.html` via `file://` in the browser and repeat Step 1 (this is the unchecked CORS case in the spec).
- [ ] **Step 5: Mobile and themes:** resize to 360px width, light and dark: no horizontal scroll, input and button full width, targets ≥ 44px.
- [ ] **Step 6: Docs:** update lg `CLAUDE.md`; report results honestly, including anything not verified.
