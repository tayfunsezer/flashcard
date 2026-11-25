(function (LG) {
  const { h } = LG.dom;
  let cache = [];
  let listening = false;
  const listeners = new Set();

  const available = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  const voices = () => cache;
  const saved = (lang) => (LG.app && LG.app.state.settings.voices && LG.app.state.settings.voices[lang]) || '';

  // Chrome fills the voice list asynchronously: read it now and again whenever it changes.
  function load() {
    if (!available()) return;
    const list = speechSynthesis.getVoices();
    if (!list.length || list.length === cache.length) return;
    cache = list.slice();
    listeners.forEach((cb) => cb());
  }

  function preload() {
    if (!available()) return;
    load();
    if (!listening) { listening = true; speechSynthesis.addEventListener('voiceschanged', load); }
  }

  function onVoices(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function hasVoice(lang) {
    return available() && !!LG.voice.pick(cache, lang, saved(lang));
  }

  // Speaks `text` in `lang` with the saved (or best) voice, cutting off whatever is playing. No voice, or nothing to read: silent.
  function speak(text, lang) {
    if (!available() || !/[\p{L}\p{N}]/u.test(String(text || ''))) return;
    const voice = LG.voice.pick(cache, lang, saved(lang));
    if (!voice) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = LG.app.state.settings.speechRate || 1;
    speechSynthesis.speak(u);
  }

  // "Listen" button speaking getText() in the language being learned; hidden while no voice is available.
  function button(getText) {
    const lang = () => LG.app.ctx.langTarget;
    const btn = h('button', { class: 'btn btn-small listen-btn', type: 'button', onclick: () => speak(getText(), lang()) }, 'Listen');
    const sync = () => { btn.style.display = hasVoice(lang()) ? '' : 'none'; };
    let seen = false;
    const off = onVoices(() => {
      if (btn.isConnected) seen = true;
      else if (seen) { off(); return; }
      sync();
    });
    sync();
    return btn;
  }

  LG.speech = { available, voices, preload, onVoices, hasVoice, speak, button };
})(globalThis.LG = globalThis.LG || {});
