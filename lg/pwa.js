// Registers the offline service worker (sw.js). Skipped on file://, where service workers do not exist.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (err) { console.warn('Offline mode unavailable:', err); });
  });
}
