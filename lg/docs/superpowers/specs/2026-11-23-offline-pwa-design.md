# Offline PWA for fc/ and lg/ — design (2026-11-23)

## Intent
> "I need you to convert that one into PWA so that I can work on that locally when there's no internet. … that repository shares 2 subsites, but it is normal, it is expected."

## Design
- Two independent installable apps, one per subsite, matching the repo's "two independent apps" rule: `fc/` and `lg/` each get `manifest.webmanifest`, `icons/icon-{180,192,512}.png`, `pwa.js` and `sw.js` (scope = its own folder).
- `sw.js` (identical in both): network-first with a 4 s timeout, falling back to the cache; navigations fall back to cached `index.html` and ignore the query string (fc's `?qCont=` quiz links work offline). Install caches `index.html` and every local file it references. No version constant: the repo is updated by GitHub web uploads, so nothing has to be bumped by hand.
- `pwa.js` registers only on http(s); `lg/` keeps working from `file://` unchanged.
- Caveat: an installed iOS Home Screen app has its own storage (separate from Safari), so existing progress must be moved with the apps' export/backup.

## Verification
Headless Chromium via a local `http.server`: both apps register the worker, then with the network off a reload and a fresh `?query` load render the app with no page errors (fc cached 8 files, lg 44).
