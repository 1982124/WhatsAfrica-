/* WASSAFRICA inbox interaction bridge.
 * The active inbox page loads this asset before its inline controller is initialized.
 * We bind only after the controller exists, then make member search live without
 * replacing the existing conversation/call behavior.
 */
(function () {
  'use strict';
  var bound = false;
  function bind() {
    if (bound) return true;
    var target = document.getElementById('target');
    var start = document.getElementById('start');
    if (!target || !start || typeof start.click !== 'function') return false;
    bound = true;
    var timer = null;
    target.addEventListener('input', function () {
      clearTimeout(timer);
      var value = target.value.trim();
      if (!value) return;
      timer = setTimeout(function () {
        if (!start.disabled) start.click();
      }, 250);
    });
    return true;
  }
  if (!bind()) {
    var tries = 0;
    var wait = setInterval(function () {
      tries += 1;
      if (bind() || tries >= 40) clearInterval(wait);
    }, 100);
  }
})();
