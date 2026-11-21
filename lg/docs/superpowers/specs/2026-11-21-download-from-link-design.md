# Download the word list from a link — design

Date: 2026-11-21. Amends `2026-11-16-whole-expression-marks-refresh-design.md` §Refresh file (adds a second source for Refresh).

Status: approved and implemented 2026-11-21. Browser-checked on localhost (desktop, 360px light/dark iframe); `file://` limit found, see Findings.

## Intent

The learner keeps the word list in a publicly published Google Sheet that has a direct TSV download link, and asked:

> "I have an excel file that is publicly available. A link even that downloads the csv directly. Is it possible for us to create a download button in the language game app for it. At past there were problems related to it"
> "Expect link to be provided on a txtbox dont hardcode it"

Today the list must be saved to disk and picked with "Choose file". Goal: paste the link into the Load screen, press a button, and get the same import flow. Later, ↻ Refresh re-downloads from that link.

## Findings

- A `fetch()` of a Google Sheets `…/pub?…&output=tsv` link works from a page on another origin: the link 307-redirects to `googleusercontent.com`, and the final response sends `access-control-allow-origin: *`. Checked from `https://example.com` on 2026-11-21 (status 200, 273,950 chars, header `POL TUR Date GROUP IGNORE LEARNT`). This is the same situation as GitHub Pages (`https://tayfunsezer.github.io/flashcard/lg/`).
- **`file://` does not work (found while verifying).** From an opaque `null` origin (a sandboxed iframe), `fetch` of the original `docs.google.com/…/pub` link fails, while the redirected `googleusercontent.com` URL succeeds: the 307 hop sends no CORS header and the page cannot read the final URL. So the feature works on the GitHub Pages address and on phones, not on a double-clicked `index.html`. The app does not try to work around it; the download error then says to open the app from its web address, and picking a file still works.
- The 307 response itself carries no CORS header, and browsers accepted it, so redirects are not a problem for this link. Other hosts may differ: only CORS-enabled links can work, which the error text must say.

## Goals

- Load screen: a link textbox plus a "Download" button, next to "Choose file".
- The downloaded bytes go through the existing pipeline (`LG.importer.readFile` → `rowsToDataset` → check-import screen), so encoding sniffing, the column picker, ids, summary and progress behave exactly as for a picked file.
- The link is remembered as `dataset.sourceUrl` and pre-fills the textbox the next time the Load screen opens with that dataset.
- ↻ Refresh (Home and in-game) re-downloads from `dataset.sourceUrl` when it is set, then uses the existing silent re-parse (stored `learnColumn`, progress kept by id).

## Mobile

The learner stated: "remember that it is mobile supported website". The app is used from phones (served over https), where there is no file handle and picking a file is clumsy, so the link flow is the main way to update the list there.

- The textbox row stacks: the input is full width on top, the Download button below it (full width at phone width, 44px minimum height like the Cloze input). No horizontal scroll at 360px.
- The input is `type="url"` with `inputmode="url"`, `autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`, so the phone keyboard shows `/` and `.` and does not mangle a pasted link.
- Pasting from the clipboard must work with the browser's native paste menu; no custom paste handling.
- Progress and errors are shown in the page (button label "Downloading…", error banner), never in a hover or tooltip.
- Refresh from the link works the same on phone, in both themes. Checked at phone width in light and dark.

## Non-goals

- No hardcoded link anywhere in the code.
- No download on boot, no timer, no background sync.
- No rewriting of other link shapes (e.g. a sheet `/edit` link): the learner pastes the published TSV/CSV link. A clear message is shown if the response is HTML.
- No reading of the sheet's `IGNORE` / `LEARNT` columns: the importer uses columns 1–4 only, as for files. Rows flagged IGNORE are still imported. Revisit on request.
- No change to the quiz JSON format or to `lg.state` (so no `VERSION` bump).

## Constraints

- Classic scripts, IIFE modules, no libraries. `fetch` of a remote https URL is allowed; fetching local files is still not.
- Feedback through `app.banner` or the Load screen error, never `alert`.
- Preserve each file's line endings (see `lg/CLAUDE.md`).

## Approaches

- **A. Load screen only.** Textbox and button feed `readAndShow`. Refresh keeps asking for a file. Simplest, but updating the sheet means pasting or pressing and walking through the check screen every time.
- **B. A plus Refresh from the link (chosen).** Adds `dataset.sourceUrl` and one branch in `app.refreshFile`. One-click updates with the existing ↻.
- **C. Fetch on boot.** Rejected: fails offline and on `file://`, and replaces data unasked.

B chosen because Refresh is already the update path and a downloaded file has no file handle, so without B the learner is sent back to the picker.

## Design

### Core: `js/core/remote.js` (`LG.remote`, pure, tested)
- `parseUrl(text)` → `{ ok, url, error }`. Trims; accepts only `http:`/`https:` via `new URL`; empty → "Paste the link first."; other schemes → "The link must start with https://".
- `fileNameFor(url, contentType)` → name with a `.tsv`/`.csv` extension chosen from the query (`output=tsv|csv`), the path extension, or the content type, falling back to `sheet.tsv`. Needed because `readAndShow` and `readFile` decide the format from the extension.
- `toFile(bytes, url, contentType)` → `File` (`fileNameFor`). Throws "The link returned a web page, not a table. Use the published TSV/CSV link." when the content type is `text/html`.
- Registered in `index.html` and `tests/manifest.js` in the same position (after `importer.js`), tests in `tests/remote.test.js`.

### UI: `js/ui/dom.js` / `js/ui/app.js` / `load.js`
- `LG.dom.download(url)` is **not** reused (that name already means saving a file). New `LG.remote.fetchFile(url, fetchImpl = fetch)` in `remote.js` does `fetch(url, { cache: 'no-store' })`, checks `response.ok`, reads `arrayBuffer()` and `content-type`, returns `toFile(...)`. `fetchImpl` is injected so tests do not touch the network. Network failure → "Could not download. Check your connection, and that the link is published to the web (the host must allow browser downloads)."
- Load screen (`renderPick`): a labelled `<input type="url">` (pre-filled from `app.dataset.sourceUrl`), a "Download" button (disabled while running, label "Downloading…"), then `readAndShow(root, file, null, url)`. Errors render through `renderPick`'s error banner.
- `readAndShow` gains a 4th argument `sourceUrl`; `renderLanguages` receives it and stores `sourceUrl` in the saved dataset (`{ items, fileName, importedAt, encoding, learnColumn, sourceUrl }`) and calls `saveHandle(null)`. Loading from a file builds a dataset without `sourceUrl`.
- `app.refreshFile`: if `app.dataset.sourceUrl`, fetch via `LG.remote.fetchFile`, then continue into the existing same-name silent re-parse path (the downloaded file name is derived from the URL, so keep it stable by reusing `app.dataset.fileName` for the `File` when refreshing). On failure show the banner with the error and keep the current data.

### Docs
- `README.md`: new "Download from a link" section (published link, CORS note, Refresh behaviour).
- `CLAUDE.md` (lg): add `remote.js` to the layout, `sourceUrl` to the dataset shape, and the Refresh paragraph.

## Left to the builder

- Exact wording and layout of the textbox row (use existing `.field` / `.row` / `.btn` classes; no emoji).
- Whether `fetchFile` reads text or bytes: bytes, so the existing encoding sniffing applies.
- Test split: `remote.test.js` covers `parseUrl`, `fileNameFor`, `toFile`, `fetchFile` with a fake `fetch`. UI and the real download are verified in the browser (`file://` and the https address) before claiming done.

## Verification before done

`node tests/run-node.js` green; manual: paste the sheet link on `file://` and on the GitHub Pages address, import, press ↻ after editing the sheet; bad link, HTML link and offline each show a readable message. Check the Load screen at 360px width in light and dark: no horizontal scroll, 44px targets, URL keyboard on a real phone if available.

## Amendment 2026-11-21: remember the link in the browser

Requested by the learner: "add a capability to keep that link in the cookies so that next time the text box is shown, the link can directly appear there. So what I'm trying to avoid is to expose that link in the source code ... we can utilize the browser cache or cookie, whatever, local storage."

- Stored in `localStorage` under `lg.sourceLink` (`LG.storage.loadLink` / `saveLink`, both tolerate a missing or throwing `localStorage`). Not a cookie: cookies are sent to the server on every request and are size-limited. Not in `lg.state`: that object is written into the exported progress file, so the link would leak into backups.
- Saved after a successful download. The textbox is pre-filled from it first, then from `dataset.sourceUrl`. It no longer depends on a dataset existing, and loading a file or the sample does not forget it (this replaces the earlier "loading a file forgets the link" note).
- Nothing about the learner's sheet is in the source, tests or docs (tests use a placeholder id).
- Not added: a "forget link" button. Clearing site data forgets it.
- Verified in the browser on a fresh origin: download → reload → box pre-filled with no dataset loaded; `lg.state` does not contain the link. 141 tests pass.
