(function (LG) {
  // Choosing a text-to-speech voice. A "voice" is any { name, lang, localService } (a SpeechSynthesisVoice).
  // Rank: Premium 3 > Enhanced 2 > other on-device 1 > online 0.
  function rank(voice) {
    if (/premium/i.test(voice.name)) return 3;
    if (/enhanced/i.test(voice.name)) return 2;
    return voice.localService ? 1 : 0;
  }

  const primary = (lang) => String(lang || '').toLowerCase().split(/[-_]/)[0];

  // Voices for a language ('pl' matches 'pl-PL' and 'pl_PL'), best first, then by name.
  function forLang(voices, lang) {
    const want = primary(lang);
    return voices.filter((v) => primary(v.lang) === want)
      .sort((a, b) => rank(b) - rank(a) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  // The saved voice when it still exists, else the best one, else null.
  function pick(voices, lang, savedName) {
    const list = forLang(voices, lang);
    return (savedName && list.find((v) => v.name === savedName)) || list[0] || null;
  }

  function label(voice) {
    return voice.localService ? voice.name : voice.name + ' (online)';
  }

  LG.voice = { rank, forLang, pick, label };
})(globalThis.LG = globalThis.LG || {});
