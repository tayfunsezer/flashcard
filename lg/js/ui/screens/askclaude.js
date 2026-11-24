(function (LG) {
  const { h, clear } = LG.dom;

  function languageName(code) {
    try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code; } catch (e) { return code; }
  }

  // Step 1: write a request file for Claude. Step 2: load Claude's response file, preview it, keep it.
  // Formats: docs/ask-claude-format.md. Nothing here talks to a network.
  LG.screens.askclaude = {
    render(root) {
      const app = LG.app;
      const C = LG.claude;
      let task = 'examples';
      let skipDone = true;
      let made = null;     // { requestName, responseName, request } after Create request file
      let loaded = null;   // { name, parsed } after Load answer file
      let shown = null;

      const scope = () => LG.words.filterItems(app.ctx.items, app.filters);
      const pick = () => C.selectItems(scope(), task, app.notes, { lang: app.ctx.langTarget, skipDone, cap: C.MAX_ITEMS });

      function create() {
        const sel = pick();
        if (!sel.items.length) return app.banner('Nothing to ask: no words match.', 'info');
        const dateIso = LG.dates.todayISO();
        const request = C.buildRequest({
          items: sel.items, task, nowMs: Date.now(), dateIso,
          languages: { learning: languageName(app.ctx.langTarget), translation: languageName(app.ctx.langSource) },
        });
        const requestName = C.requestFileName(task, dateIso);
        LG.dom.download(requestName, JSON.stringify(request, null, 2));
        app.setNotes(C.withLastRequest(app.notes, request));
        made = { requestName, responseName: request.respondWith.fileName, request };
        draw();
        app.banner('Saved ' + requestName + ' (' + request.items.length + ' words) to your downloads.', 'info');
      }

      async function load() {
        const file = await LG.dom.pickFile('.json,application/json');
        if (!file) return;
        let text;
        try { text = await file.text(); } catch (e) { return app.banner('The file could not be read.', 'error'); }
        const parsed = C.parseResponse(text, { ids: app.ctx.itemsById, lastRequest: app.notes.lastRequest });
        if (!parsed.ok) { loaded = null; draw(); return app.banner(parsed.error, 'error'); }
        loaded = { name: file.name, parsed };
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

      function clearAll() {
        if (!window.confirm('Remove all answers loaded from Claude? Your words and progress are not touched.')) return;
        app.setNotes(C.emptyNotes());
        draw();
      }

      function requestCard() {
        const sel = pick();
        const def = C.TASKS[task];
        const taskSelect = h('select', { 'aria-label': 'Task', onchange: (e) => { task = e.target.value; made = null; draw(); } },
          C.TASK_IDS.map((id) => h('option', { value: id, selected: id === task }, C.TASKS[id].label)));
        const skip = h('input', { type: 'checkbox', checked: skipDone, onchange: (e) => { skipDone = e.target.checked; made = null; draw(); } });
        const line = sel.items.length + (sel.items.length === 1 ? ' word' : ' words') + ' from your current filters'
          + (sel.done ? ' (' + sel.done + ' already answered' + (skipDone ? ', skipped' : '') + ')' : '')
          + (sel.cap ? '. Capped at ' + C.MAX_ITEMS + ': ask again for the rest.' : '.');
        const copyBox = made ? h('div', { class: 'stack handoff' },
          h('p', { class: 'muted small' }, 'Give Claude this sentence (it reads ' + made.requestName + ' from your Downloads folder):'),
          h('textarea', { class: 'handoff-text', readonly: true, rows: '3', 'aria-label': 'Sentence for Claude' }, C.handoffSentence(made.requestName, made.responseName)),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-small copy-handoff', type: 'button', onclick: async () => {
            try { await navigator.clipboard.writeText(C.handoffSentence(made.requestName, made.responseName)); app.banner('Copied.', 'info'); } catch (e) { app.banner('Copy failed: select the text and copy it.', 'warn'); }
          } }, 'Copy'))) : null;
        return h('div', { class: 'card stack' },
          h('h2', null, '1. Ask'),
          h('label', { class: 'field' }, h('span', null, 'Task'), taskSelect),
          h('p', { class: 'muted small' }, def.blurb),
          h('p', { class: 'scope-line' }, line, h('span', { class: 'muted small' }, ' Change the words with the Filters on Home.')),
          h('label', { class: 'row' }, skip, ' Skip words that already have an answer'),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-primary create-request', type: 'button', disabled: !sel.items.length, onclick: create }, 'Create request file')),
          copyBox);
      }

      function previewCard() {
        const body = [h('h2', null, '2. Load the answer'),
          h('p', { class: 'muted small' }, 'Claude writes a response file next to the request. Pick it here to see it before anything is saved.'),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn load-answer', type: 'button', onclick: load }, 'Load answer file…'))];
        if (loaded) {
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
          h('p', { class: 'muted small' }, 'Claude and this app trade two files: you create a request, give it to Claude, and load Claude’s answer. Nothing is sent over the network.'),
          requestCard(), previewCard(),
          h('div', { class: 'card spread' },
            h('span', { class: 'muted small saved-line' }, 'Saved answers: ' + saved + (saved === 1 ? ' word' : ' words')),
            h('button', { class: 'btn btn-small clear-notes', type: 'button', disabled: !saved, onclick: clearAll }, 'Clear')));
        clear(root).append(shown);
      }

      draw();
    },
  };
})(globalThis.LG = globalThis.LG || {});
