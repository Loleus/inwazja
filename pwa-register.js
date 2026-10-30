/* Rejestracja service workera i autoaktualizacja PWA — dołączane do index.html przez scripts/build.mjs.

   Przebieg aktualizacji:
   1. Co CHECK_EVERY_MS, po powrocie na kartę i po odzyskaniu sieci pytamy o nowy sw.js
      (plik pobierany z pominięciem pamięci HTTP, więc hosting nie ma wpływu).
   2. Nowy worker instaluje się sam, przejmuje stronę i usuwa starą pamięć.
   3. Stronę przeładowujemy dopiero w bezpiecznej scenie (menu). Rozgrywka nie ma zapisu stanu,
      więc przeładowanie w trakcie fali zniszczyłoby grę — wtedy czekamy na powrót do menu.
   Aktualną scenę wystawia createGame jako <html data-scene> i zdarzenie `inwazja:scene`. */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;

  var CHECK_EVERY_MS = 15 * 60 * 1000;
  var MIN_GAP_MS = 60 * 1000;
  var SAFE_SCENES = { '': true, BootScene: true, MenuScene: true };

  // Adres workera liczony od tego skryptu (leży obok sw.js), więc nie zależy od adresu strony.
  var scriptUrl = document.currentScript && document.currentScript.src;
  var workerUrl = scriptUrl ? new URL('sw.js', scriptUrl).href : './sw.js';

  var hadController = !!navigator.serviceWorker.controller;
  var updateReady = false;
  var reloading = false;
  var registration = null;
  var lastCheck = 0;

  function isSafeScene() {
    return SAFE_SCENES[document.documentElement.dataset.scene || ''] === true;
  }

  function applyUpdate() {
    if (!updateReady || reloading || !isSafeScene()) return;
    reloading = true;
    location.reload();
  }

  function checkForUpdate(force) {
    var now = Date.now();
    if (!registration || (!force && now - lastCheck < MIN_GAP_MS)) return;
    lastCheck = now;
    registration.update().catch(function () {});
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    // Pierwsza instalacja: strona jest już aktualna, nic do przeładowania.
    if (!hadController) {
      hadController = true;
      return;
    }
    updateReady = true;
    applyUpdate();
  });

  window.addEventListener('inwazja:scene', applyUpdate);
  window.addEventListener('online', function () {
    checkForUpdate(false);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') checkForUpdate(false);
  });

  function register() {
    navigator.serviceWorker
      .register(workerUrl, { updateViaCache: 'none' })
      .then(function (reg) {
        registration = reg;
        lastCheck = Date.now();
        setInterval(function () {
          checkForUpdate(true);
        }, CHECK_EVERY_MS);
      })
      .catch(function () {});
  }

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
})();
