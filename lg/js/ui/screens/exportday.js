(function (LG) {
  const { h } = LG.dom;

  // Export every word of one date as a quiz file: into the chosen repeated-words folder, or as a download.
  LG.screens.exportday = {
    render(root) {
      const app = LG.app;
      const items = app.ctx.items;
      const days = LG.dayexport.datesIn(items);
      const skipped = items.length - days.reduce((n, d) => n + d.count, 0);
      const canPick = typeof globalThis.showDirectoryPicker === 'function';
      let date = days.length ? days[0].date : '';
      let dirHandle = null;
      let exists = false;
      let shown = null; // the element this screen last drew; if Home replaced it, stop redrawing

      const build = () => {
        const parts = LG.dayexport.relPath(date);
        const quiz = LG.dayexport.dayQuiz(items, date, app.ctx.langTarget, Math.random);
        return { parts, text: JSON.stringify(quiz, null, 2), count: quiz.length };
      };

      const download = (why) => {
        const b = build();
        LG.dom.download(b.parts[2], b.text);
        app.banner((why ? why + ' ' : '') + 'Downloaded ' + b.parts[2] + '. Put it in ' + b.parts[0] + '/' + b.parts[1] + '/.', 'info');
      };

      const chooseFolder = async () => {
        try {
          dirHandle = await globalThis.showDirectoryPicker({ mode: 'readwrite' });
          exists = false; // a new folder has not been checked yet
          try { await LG.storage.saveDirHandle(dirHandle); } catch (e) { /* chosen again next visit */ }
        } catch (e) {
          if (!e || e.name !== 'AbortError') app.banner('The folder could not be opened: ' + ((e && e.message) || e), 'error');
        }
        draw();
      };

      const doExport = async (overwrite) => {
        if (!dirHandle) return download(canPick ? 'No folder chosen.' : 'This browser cannot write to folders.');
        try {
          if (dirHandle.requestPermission && await dirHandle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
            return download('Folder access was not allowed.');
          }
          const b = build();
          const res = await LG.dayexport.writeToRepo(dirHandle, b.parts, b.text, overwrite);
          exists = res === 'exists';
          draw();
          if (!exists) app.banner((overwrite ? 'Overwrote ' : 'Saved ') + b.parts.join('/') + ' (' + b.count + ' words).', 'info');
        } catch (e) {
          download('Could not write to the folder (' + ((e && (e.message || e.name)) || e) + ').');
        }
      };

      const draw = () => {
        if (shown && root.firstChild !== shown) return;
        const parts = date ? LG.dayexport.relPath(date) : [];
        const select = h('select', { 'aria-label': 'Day to export', onchange: (e) => { date = e.target.value; exists = false; draw(); } },
          days.map((d) => h('option', { value: d.date, selected: d.date === date }, LG.dates.formatDate(d.date) + ' (' + d.count + (d.count === 1 ? ' word)' : ' words)'))));
        shown = h('div', { class: 'screen' },
          h('div', { class: 'topbar' }, h('h1', null, 'Export a day'),
            h('button', { class: 'btn', type: 'button', onclick: () => app.go('home') }, 'Back')),
          days.length
            ? h('div', { class: 'card' },
              h('label', { class: 'field' }, h('span', null, 'Day'), select),
              skipped ? h('p', { class: 'muted small' }, skipped + (skipped === 1 ? ' word has' : ' words have') + ' no date and ' + (skipped === 1 ? 'is' : 'are') + ' skipped.') : null,
              h('p', { class: 'export-path', style: 'margin:10px 0; overflow-wrap:anywhere' }, parts.join('/')),
              canPick ? h('div', { class: 'btn-row', style: 'margin-bottom:8px' },
                h('span', { class: 'muted small' }, dirHandle ? 'Folder: ' + dirHandle.name : 'No folder chosen'),
                h('button', { class: 'btn btn-small choose-folder', type: 'button', onclick: chooseFolder }, dirHandle ? 'Change' : 'Choose folder')) : null,
              exists
                ? h('div', { class: 'exists-prompt' },
                  h('p', null, parts.join('/') + ' already exists.'),
                  h('div', { class: 'btn-row' },
                    h('button', { class: 'btn btn-primary overwrite', type: 'button', onclick: () => doExport(true) }, 'Overwrite'),
                    h('button', { class: 'btn download-copy', type: 'button', onclick: () => { exists = false; draw(); download(''); } }, 'Download a copy'),
                    h('button', { class: 'btn cancel', type: 'button', onclick: () => { exists = false; draw(); } }, 'Cancel')))
                : h('div', { class: 'btn-row' },
                  h('button', { class: 'btn btn-primary export-go', type: 'button', onclick: () => doExport(false) }, 'Export')))
            : h('div', { class: 'card' }, h('p', { class: 'muted' }, 'No words with a date in this file.')));
        LG.dom.clear(root).append(shown);
      };

      draw();
      LG.storage.loadDirHandle().then((hd) => { if (hd) { dirHandle = hd; draw(); } }).catch(() => {});
    },
  };
})(globalThis.LG = globalThis.LG || {});
