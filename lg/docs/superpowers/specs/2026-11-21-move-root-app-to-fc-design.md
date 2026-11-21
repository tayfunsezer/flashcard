# Move the root flashcard app into `fc/` — design

Date: 2026-11-21. Status: approved by the learner 2026-11-21.

## Intent

> "I don't want root file, root app to be on the root anymore. Just like language game is a subfolder, let's make root flashcard also a subfolder, and I think its name shouldn't be root anymore. I don't mind its URL would be changing or I don't mind that there is no valid index.html in the root. I can just type folder name, this is the system that I use only." / "FC is fine." / "You can just delete Amazon Q and Copilot instruction files. Also delete the wishlist too."

## Goals

- `index.html`, `app.js`, `quiz.js`, `styles.css`, `quiz-styles.css` move to `fc/` with `git mv` (history follows). The app works unchanged from `fc/index.html`.
- The app is no longer called "root app" in the docs: it is `fc/` (Polish–Turkish Flashcard), as `lg/` is the Language Game.
- Delete `.amazonq/`, `.copilot-instructions` and `wishlist.txt` (stale tool docs and a finished wishlist).
- Root `CLAUDE.md` and `lg/CLAUDE.md` point at the new paths. Pushed to `main`.

## Non-goals

- No code changes inside the moved files, no redirect or landing page at the repo root, no change to `lg/`. `test-push.txt` stays. Old docs under `lg/docs/superpowers/` keep their wording (history).

## Consequences (accepted by the learner)

- The app lives at `…github.io/flashcard/fc/`; the repo root has no `index.html`, so `…/flashcard/` is a 404.
- Previously shared quiz links (`?qCont=`, `#qData=`, `#words=`) stop working; links the app generates from now on use the new address (they are built from `location.origin + pathname`).

## Design

Moved files only reference each other by relative name (no `../`), and `lg/` does not reference them, so the move needs no edits to code. Docs: rename "Root app" to "`fc/`" in `CLAUDE.md` (table, entry paths, section titles, "served statically" line, running notes), drop the stale-docs and wishlist paragraph, and make `lg/CLAUDE.md` say "the `fc/` app" instead of "root app".

## Approaches

One sensible way: `git mv` plus doc updates. A redirect page at the root was rejected (the learner does not need one).
