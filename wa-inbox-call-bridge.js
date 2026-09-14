/* WASSAFRICA — inbox bridge: messaging, media and calls stay inside one conversation. */
(function () {
  'use strict';
  var searchBound = false;
  var lastConversationId = null;
  var contextTimer = null;
  var callsReady = false;

  function initCalls() {
    if (callsReady || !window.WA_CALLS || typeof window.WA_CALLS.init !== 'function') return false;
    var sb = window.supabase;
    if (!sb || typeof sb.createClient !== 'function') return false;
    try {
      var db = sb.createClient('https://dzifpwqrqnvssfhwjccj.supabase.co', 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV', { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      db.auth.getSession().then(function (r) {
        var u = r && r.data && r.data.session && r.data.session.user;
        if (!u) return;
        window.WA_CALLS.init(db, u);
        callsReady = true;
      }).catch(function () {});
    } catch (_) {}
    return callsReady;
  }

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
      timer = setTimeout(function () { if (!start.disabled) start.click(); }, 250);
    });
    return true;
  }

  function syncConversationContext() {
    var id = window.__WA_CURRENT_CONVERSATION_ID;
    if (!id || id === lastConversationId) return;
    var media = window.WA_MEDIA_P2P;
    if (!media || typeof media.setConversation !== 'function') return;
    lastConversationId = id;
    Promise.resolve(media.setConversation(id)).catch(function () {});
  }

  function boot() {
    bindSearch();
    initCalls();
    syncConversationContext();
    if (!contextTimer) contextTimer = setInterval(function () { bindSearch(); initCalls(); syncConversationContext(); }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();