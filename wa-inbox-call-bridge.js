/* WASSAFRICA — inbox bridge: keep messaging, media and calls inside one conversation. */
(function () {
  'use strict';

  var searchBound = false;
  var lastConversationId = null;
  var contextTimer = null;

  function bindSearch() {
    if (searchBound) return true;
    var target = document.getElementById('target');
    var start = document.getElementById('start');
    if (!target || !start || typeof start.click !== 'function') return false;

    searchBound = true;
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

  /*
   * inbox-v25 already publishes the active conversation id when openConv()
   * runs. Media P2P exposes setConversation(), and the WebRTC layer wraps
   * that method to keep its own call context in sync. Calling it here removes
   * the old architectural gap that left the inline call controls disabled.
   */
  function syncConversationContext() {
    var id = window.__WA_CURRENT_CONVERSATION_ID;
    if (!id || id === lastConversationId) return;
    var media = window.WA_MEDIA_P2P;
    if (!media || typeof media.setConversation !== 'function') return;

    lastConversationId = id;
    Promise.resolve(media.setConversation(id)).catch(function () {
      /* The message view remains usable even if media/call context is late. */
    });
  }

  function boot() {
    bindSearch();
    syncConversationContext();
    if (!contextTimer) {
      contextTimer = setInterval(function () {
        bindSearch();
        syncConversationContext();
      }, 250);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
