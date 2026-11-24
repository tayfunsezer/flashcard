(function (LG) {
  const { h, clear } = LG.dom;
  const LIST_MAX = 100;

  function languageName(code) {
    try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code; } catch (e) { return code; }
  }

  // Step 1: write a request file for Claude (words from the Home filters, or picked one by one). Step 2: load Claude's
  // answer file and check it: example sentences are kept in the app, a case-endings quiz is cleaned and saved as a quiz file.
  // Formats: docs/ask-claude-format.md. Nothing here talks to a network.
  LG.screens.askclaude = {
    render(root) {
      const app = LG.app;
      const C = LG.claude;
      let task = 'endings';
      let skipDone = true;
      let singleWords = true;
      let mode = 'filters';        // 'filters' | 'pick'
      let picked = new Set();
      let search = '';
      let made = null;             // { requestName, responseName } after Create request file
      let loaded = null;           // { name, kind: 'notes' | 'quiz', parsed }
      let shown = null;
      const els = {};

      const inScope = () => (mode === 'pick' ? app.ctx.items.filter((it) => picked.has(it.id)) : LG.words.filterItems(app.ctx.items, app.filters));
      const select = () => C.selectItems(inScope(), task, app.notes, { lang: app.ctx.langTarget, skipDone, singleWords });

      function create() {
        const sel = select();
        if (!sel.items.length) return app.banner('Nothing to ask: no words match.', 'info');
        const dateIso = LG.dates.todayISO();
        const request = C.buildRequest({
          items: sel.items, task, nowMs: Date.now(), dateIso, singleWords,
          languages: { learning: languageName(app.ctx.langTarget), translation: languageName(app.ctx.langSource) },
        });
        const requestName = C.requestFileName(task, dateIso);
        LG.dom.download(requestName, JSON.stringify(request, null, 2));
        app.setNotes(C.withLastRequest(app.notes, request));
        made = { requestName, responseName: request.respondWith.fileName };
        draw();
        app.banner('Saved ' + requestName + ' (' + request.items.length + ' words) to your downloads.', 'info');
      }

      async function load() {
        const file = await LG.dom.pickFile('.json,application/json');
        if (!file) return;
        let text;
        try { text = await file.text(); } catch (e) { return app.banner('The file could not be read.', 'error'); }
        if (C.TASKS[task].kind === 'quiz') {
          const parsed = C.parseQuiz(text);
          if (!parsed.ok) { loaded = null; draw(); return app.banner(parsed.error, 'error'); }
          loaded = { name: file.name, kind: 'quiz', parsed };
        } else {
          const parsed = C.parseResponse(text, { ids: app.ctx.itemsById, lastRequest: app.notes.lastRequest });
          if (!parsed.ok) { loaded = null; draw(); return app.banner(parsed.error, 'error'); }
          loaded = { name: file.name, kind: 'notes', parsed };
        }
        draw();
      }

      function accept() {
        const p = loaded.parsed;
        const n = Object.keys(p.results).length;
        app.setNotes(C.mergeNotes(app.notes, p.task, p.results));
        loaded = null;
        draw();
        app.banner('Saved ' + n + (n === 1 ? ' answer.' : ' answers.'), 'info');
      }

      function saveQuiz() {
        const qs = loaded.parsed.questions;
        const name = C.quizFileName(LG.dates.todayISO());
        LG.dom.download(name, JSON.stringify(qs, null, 2));
        app.banner('Saved ' + name + ' (' + qs.length + ' questions) to your downloads. Load it like any quiz file.', 'info');
      }

      function clearAll() {
        if (!window.confirm('Remove all example sentences loaded from Claude? Your words and progress are not touched.')) return;
        app.setNotes(C.emptyNotes());
        draw();
      }

      // Updates the count line, the over-50 warning and the Create button without redrawing the pick list.
      function refreshScope() {
        const sel = select();
        const n = sel.items.length;
        els.line.textContent = n + (n === 1 ? ' word' : ' words') + (mode === 'pick' ? ' picked' : ' from your current filters')
          + (sel.done ? ' (' + sel.done + ' already answered' + (skipDone ? ', skipped' : '') + ')' : '')
          + (task === 'endings' && !singleWords && inScope().length > n ? ' (' + (inScope().length - n) + ' single words left out)' : '') + '.';
        els.warn.hidden = !C.overLimit(n);
        els.warn.textContent = n + ' words is over ' + C.WARN_OVER + '. Claude’s answer may be long or cut off; a smaller date range or the pick list keeps it short.';
        els.create.disabled = !n;
      }

      function drawList() {
        const q = search.trim().toLowerCase();
        const all = app.ctx.items.filter((it) => !q || it.target.toLowerCase().includes(q) || it.source.toLowerCase().includes(q));
        const rows = all.slice(0, LIST_MAX);
        els.listInfo.textContent = (all.length > LIST_MAX ? 'Showing the first ' + LIST_MAX + ' of ' + all.length + ' matches: type to narrow down.' : all.length + (all.length === 1 ? ' word' : ' words') + '.');
        els.tickShown.onclick = () => { rows.forEach((it) => picked.add(it.id)); drawList(); refreshScope(); };
        els.untickShown.onclick = () => { rows.forEach((it) => picked.delete(it.id)); drawList(); refreshScope(); };
        clear(els.list).append(...rows.map((it) => h('label', { class: 'mm-row' },
          h('input', { type: 'checkbox', checked: picked.has(it.id), onchange: (e) => {
            if (e.target.checked) picked.add(it.id); else picked.delete(it.id);
            refreshScope();
          } }),
          h('span', { class: 'mm-text', lang: app.ctx.langTarget }, it.target, h('span', { class: 'muted small' }, it.source)))));
      }

      function pickBox() {
        els.search = h('input', { type: 'search', class: 'pick-search', placeholder: 'Search words…', 'aria-label': 'Search words', value: search,
          oninput: (e) => { search = e.target.value; drawList(); } });
        els.listInfo = h('span', { class: 'muted small' });
        els.tickShown = h('button', { class: 'btn btn-small', type: 'button' }, 'Tick shown');
        els.untickShown = h('button', { class: 'btn btn-small', type: 'button' }, 'Untick shown');
        els.list = h('div', { class: 'pick-list' });
        const none = h('button', { class: 'btn btn-small', type: 'button', onclick: () => { picked.clear(); drawList(); refreshScope(); } }, 'Clear all');
        const box = h('div', { class: 'stack pick-box' }, els.search, h('div', { class: 'btn-row' }, els.tickShown, els.untickShown, none, els.listInfo), els.list);
        drawList();
        return box;
      }

      function requestCard() {
        const def = C.TASKS[task];
        const taskSelect = h('select', { 'aria-label': 'Use case', onchange: (e) => { task = e.target.value; made = null; loaded = null; draw(); } },
          C.TASK_IDS.map((id) => h('option', { value: id, selected: id === task }, C.TASKS[id].label)));
        const modeSeg = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Which words' },
          h('button', { class: 'btn mode-filters' + (mode === 'filters' ? ' active' : ''), type: 'button', 'aria-pressed': String(mode === 'filters'), onclick: () => { mode = 'filters'; made = null; draw(); } }, 'From Home filters'),
          h('button', { class: 'btn mode-pick' + (mode === 'pick' ? ' active' : ''), type: 'button', 'aria-pressed': String(mode === 'pick'), onclick: () => {
            if (mode !== 'pick') picked = new Set(LG.words.filterItems(app.ctx.items, app.filters).map((it) => it.id));
            mode = 'pick'; made = null; draw();
          } }, 'Pick myself'));
        els.line = h('span', { class: 'scope-text' });
        els.warn = h('p', { class: 'warn-line over-warning', role: 'status', hidden: true });
        els.create = h('button', { class: 'btn btn-primary create-request', type: 'button', onclick: create }, 'Create request file');
        const handoff = made ? C.handoffSentence(made.requestName, made.responseName) : '';
        const copyBox = made ? h('div', { class: 'stack handoff' },
          h('p', { class: 'muted small' }, 'Give Claude this sentence (it reads ' + made.requestName + ' from your Downloads folder):'),
          h('textarea', { class: 'handoff-text', readonly: true, rows: '3', 'aria-label': 'Sentence for Claude' }, handoff),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-small copy-handoff', type: 'button', onclick: async () => {
            try { await navigator.clipboard.writeText(handoff); app.banner('Copied.', 'info'); } catch (e) { app.banner('Copy failed: select the text and copy it.', 'warn'); }
          } }, 'Copy'))) : null;
        const options = [];
        if (def.kind === 'notes') {
          options.push(h('label', { class: 'check-row' }, h('input', { type: 'checkbox', class: 'skip-done', checked: skipDone, onchange: (e) => { skipDone = e.target.checked; made = null; refreshScope(); } }), h('span', null, 'Skip words that already have an answer')));
        } else {
          options.push(h('label', { class: 'check-row' }, h('input', { type: 'checkbox', class: 'single-words', checked: singleWords, onchange: (e) => { singleWords = e.target.checked; made = null; refreshScope(); } }), h('span', null, 'Let Claude write a short sentence for single words')));
        }
        const card = h('div', { class: 'card stack' },
          h('h2', null, '1. Ask'),
          h('label', { class: 'field' }, h('span', null, 'Use case'), taskSelect),
          h('p', { class: 'muted small' }, def.blurb),
          modeSeg,
          mode === 'pick' ? pickBox() : h('p', { class: 'muted small' }, 'Change the words with the Filters on Home: a whole date, a whole category.'),
          h('p', { class: 'scope-line' }, els.line), els.warn, ...options,
          h('div', { class: 'btn-row' }, els.create), copyBox);
        refreshScope();
        return card;
      }

      function previewCard() {
        const body = [h('h2', null, '2. Load the answer'),
          h('p', { class: 'muted small' }, C.TASKS[task].kind === 'quiz'
            ? 'Claude writes a quiz file. Pick it here to check it before you use it.'
            : 'Claude writes a response file next to the request. Pick it here to see it before anything is saved.'),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn load-answer', type: 'button', onclick: load }, 'Load answer file…'))];
        if (loaded && loaded.kind === 'quiz') {
          const p = loaded.parsed;
          const n = p.questions.length;
          const cards = p.questions.map((q) => h('li', { class: 'quiz-q' }, h('span', { lang: app.ctx.langTarget }, q.question),
            h('div', { class: 'muted small' }, q.options.map((o, i) => h('span', { class: 'quiz-opt' + (i === q.correctIndex ? ' quiz-ok' : '') }, (i ? ' · ' : '') + (i === q.correctIndex ? '✓ ' : '') + o)))));
          body.push(h('div', { class: 'stack answer-preview' },
            h('p', null, h('strong', null, loaded.name), ' · ' + n + (n === 1 ? ' question' : ' questions')),
            p.rejected.length ? h('p', { class: 'muted small rejected' }, 'Rejected ' + p.rejected.length + ': ' + p.rejected.slice(0, 5).map((r) => '#' + (r.index + 1) + ' ' + r.reason).join('; ') + (p.rejected.length > 5 ? ' and more' : '') + '.') : null,
            h('ol', { class: 'quiz-list' }, cards),
            h('div', { class: 'btn-row' },
              h('button', { class: 'btn btn-primary save-quiz', type: 'button', disabled: !n, onclick: saveQuiz }, 'Save quiz file (' + n + ')'),
              h('button', { class: 'btn cancel-answer', type: 'button', onclick: () => { loaded = null; draw(); } }, 'Cancel'))));
        } else if (loaded) {
          const p = loaded.parsed;
          const n = Object.keys(p.results).length;
          const rows = Object.entries(p.results).map(([id, v]) => {
            const it = app.ctx.itemsById.get(id);
            const cur = app.notes.byId[id] && app.notes.byId[id][p.task];
            return h('tr', null, h('td', { lang: app.ctx.langTarget }, it.target, h('div', { class: 'muted small' }, it.source)),
              h('td', null, C.formatResult(p.task, v)), h('td', { class: 'muted' }, cur ? C.formatResult(p.task, cur) : '—'));
          });
          body.push(h('div', { class: 'stack answer-preview' },
            h('p', null, h('strong', null, loaded.name), ' · ' + C.TASKS[p.task].label + ' · ' + n + (n === 1 ? ' answer' : ' answers')),
            p.unknown ? h('p', { class: 'muted small' }, p.unknown + (p.unknown === 1 ? ' answer is' : ' answers are') + ' for words that are not in your file and will be ignored.') : null,
            p.rejected.length ? h('p', { class: 'muted small rejected' }, 'Rejected: ' + p.rejected.slice(0, 5).map((r) => (app.ctx.itemsById.get(r.id).target) + ' (' + r.reason + ')').join('; ') + (p.rejected.length > 5 ? ' and ' + (p.rejected.length - 5) + ' more' : '') + '.') : null,
            p.warnings.map((w) => h('p', { class: 'muted small' }, w)),
            p.note ? h('p', { class: 'muted small' }, 'Claude says: ' + p.note) : null,
            n ? h('table', { class: 'preview' }, h('thead', null, h('tr', null, h('th', null, 'Word'), h('th', null, 'New'), h('th', null, 'Now'))), h('tbody', null, rows)) : null,
            h('div', { class: 'btn-row' },
              h('button', { class: 'btn btn-primary accept-answer', type: 'button', disabled: !n, onclick: accept }, 'Save ' + n + (n === 1 ? ' answer' : ' answers')),
              h('button', { class: 'btn cancel-answer', type: 'button', onclick: () => { loaded = null; draw(); } }, 'Cancel'))));
        }
        return h('div', { class: 'card stack' }, body);
      }

      function draw() {
        if (shown && root.firstChild !== shown) return;
        const saved = C.countNotes(app.notes);
        shown = h('div', { class: 'screen' },
          h('div', { class: 'topbar' }, h('h1', null, 'Ask Claude'),
            h('button', { class: 'btn', type: 'button', onclick: () => app.go('home') }, 'Back')),
          h('p', { class: 'muted small' }, 'Claude and this app trade files: you create a request, give it to Claude, and load Claude’s answer. Nothing is sent over the network.'),
          requestCard(), previewCard(),
          h('div', { class: 'card spread' },
            h('span', { class: 'muted small saved-line' }, 'Saved example sentences: ' + saved + (saved === 1 ? ' word' : ' words')),
            h('button', { class: 'btn btn-small clear-notes', type: 'button', disabled: !saved, onclick: clearAll }, 'Clear')));
        clear(root).append(shown);
      }

      draw();
    },
  };
})(globalThis.LG = globalThis.LG || {});
