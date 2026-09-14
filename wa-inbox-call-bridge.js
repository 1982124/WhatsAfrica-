/* WASSAFRICA — inbox bridge: keep messaging, media, calls and E2EE device recovery inside one conversation. */
(function () {
  'use strict';

  var searchBound = false;
  var lastConversationId = null;
  var contextTimer = null;
  var recoveryChannels = new Map();
  var recoveryBusy = new Set();
  var SB = 'https://dzifpwqrqnvssfhwjccj.supabase.co';
  var KEY = 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
  var DB_NAME = 'wassafrica-msg-v20';

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

  function b64(x) {
    var s = '';
    new Uint8Array(x).forEach(function (b) { s += String.fromCharCode(b); });
    return btoa(s);
  }

  function ub64(s) {
    return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); });
  }

  function sessionLike(x) {
    return x && typeof x === 'object' && typeof x.access_token === 'string' && x.user && x.user.id ? x : null;
  }

  function readSession() {
    try {
      var keys = Array.from({ length: localStorage.length }, function (_, i) { return localStorage.key(i); }).filter(Boolean);
      var preferred = ['whatsafrica-auth'].concat(keys.filter(function (k) { return k !== 'whatsafrica-auth'; }));
      for (var i = 0; i < preferred.length; i++) {
        try {
          var raw = JSON.parse(localStorage.getItem(preferred[i]) || 'null');
          var s = sessionLike(raw) || sessionLike(raw && raw.session) || sessionLike(raw && raw.currentSession) || sessionLike(raw && raw.data && raw.data.session);
          if (s) return s;
        } catch (_) {}
      }
    } catch (_) {}
    return null;
  }

  function vault() {
    return new Promise(function (resolve, reject) {
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () {
        if (!r.result.objectStoreNames.contains('k')) r.result.createObjectStore('k');
      };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }

  function vaultGet(k) {
    return vault().then(function (d) {
      return new Promise(function (resolve, reject) {
        var r = d.transaction('k').objectStore('k').get(k);
        r.onsuccess = function () { d.close(); resolve(r.result || null); };
        r.onerror = function () { d.close(); reject(r.error); };
      });
    });
  }

  async function rest(path, options) {
    var s = readSession();
    if (!s) throw new Error('AUTH_REQUIRED');
    var headers = new Headers((options && options.headers) || {});
    headers.set('apikey', KEY);
    headers.set('Authorization', 'Bearer ' + s.access_token);
    if (options && options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    var response = await fetch(SB + '/rest/v1/' + path, Object.assign({}, options || {}, { headers: headers }));
    var data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error((data && (data.message || data.code || data.details)) || 'REQUEST_FAILED');
    return data;
  }

  async function identity() {
    var s = readSession();
    if (!s || !s.user || !s.user.id) throw new Error('AUTH_REQUIRED');
    var saved = await vaultGet('id:' + s.user.id);
    if (!saved || !saved.privateJwk || !saved.publicJwk) throw new Error('IDENTITY_NOT_FOUND');
    return {
      userId: s.user.id,
      publicJwk: saved.publicJwk,
      privateKey: await crypto.subtle.importKey('jwk', saved.privateJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt'])
    };
  }

  async function deviceRecord(id) {
    var rows = await rest('user_devices?select=id,identity_public_key,revoked_at,device_label&user_id=eq.' + encodeURIComponent(id) + '&device_label=eq.Web&order=last_seen_at.desc&limit=50');
    return rows || [];
  }

  function sameJwk(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; }
  }

  async function ownDevice(info) {
    var rows = await deviceRecord(info.userId);
    for (var i = 0; i < rows.length; i++) if (sameJwk(rows[i].identity_public_key, info.publicJwk)) return rows[i];
    return null;
  }

  async function rsaWrap(jwk, rawKey) {
    var publicKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
    return new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey));
  }

  async function rsaUnwrap(privateKey, wrapped) {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, ub64(wrapped)));
  }

  async function openRecoveryChannel(conversationId, info, own) {
    if (!window.supabase || typeof window.supabase.createClient !== 'function' || !own) return null;
    if (recoveryChannels.has(conversationId)) return recoveryChannels.get(conversationId);

    var client = window.supabase.createClient(SB, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    try { await client.auth.setSession(readSession()); } catch (_) {}
    var channel = client.channel('wa-key-recovery:' + conversationId, { config: { broadcast: { ack: true, self: false } } });

    channel.on('broadcast', { event: 'key-recovery-request' }, async function (event) {
      var p = event && event.payload || {};
      if (!p || p.requesterUserId !== info.userId || p.requesterDeviceId === own.id) return;
      if (!p.requesterPublicKey || !Array.isArray(p.keyVersions)) return;
      try {
        var devices = await deviceRecord(info.userId);
        var target = devices.find(function (d) { return String(d.id) === String(p.requesterDeviceId); });
        if (!target || target.revoked_at) return;

        var envelopes = await rest('conversation_key_envelopes?select=device_id,key_version,wrapped_key,revoked_at&conversation_id=eq.' + encodeURIComponent(conversationId) + '&device_id=eq.' + encodeURIComponent(own.id) + '&key_version=in.(' + p.keyVersions.map(function (v) { return encodeURIComponent(Number(v)); }).join(',') + ')&order=key_version.asc');
        var recovered = [];
        for (var i = 0; i < (envelopes || []).length; i++) {
          var env = envelopes[i];
          try {
            var raw = await rsaUnwrap(info.privateKey, env.wrapped_key);
            var wrapped = await rsaWrap(p.requesterPublicKey, raw);
            await rest('conversation_key_envelopes', {
              method: 'POST',
              headers: { 'Prefer': 'return=minimal' },
              body: JSON.stringify({
                conversation_id: conversationId,
                device_id: p.requesterDeviceId,
                key_version: Number(env.key_version),
                algorithm: 'RSA-OAEP-2048-SHA256+AES-256-GCM',
                wrapped_key: b64(wrapped)
              })
            });
            recovered.push(Number(env.key_version));
          } catch (e) {
            if (!/duplicate|23505/i.test(String(e && e.message || e))) console.warn('[WASSAFRICA] key recovery envelope failed', e);
          }
        }
        await channel.send({ type: 'broadcast', event: 'key-recovery-response', payload: { requesterDeviceId: p.requesterDeviceId, responderDeviceId: own.id, recovered: recovered } });
      } catch (e) {
        console.warn('[WASSAFRICA] key recovery responder failed', e);
      }
    });

    channel.on('broadcast', { event: 'key-recovery-response' }, function (event) {
      var p = event && event.payload || {};
      if (!p || String(p.requesterDeviceId) !== String(own.id)) return;
      if (Array.isArray(p.recovered) && p.recovered.length) {
        recoveryBusy.delete(conversationId);
        window.dispatchEvent(new CustomEvent('wassafrica:key-recovered', { detail: { conversationId: conversationId, versions: p.recovered } }));
        setTimeout(function () { location.reload(); }, 250);
      }
    });

    await new Promise(function (resolve) {
      channel.subscribe(function (status) { if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve(); });
      setTimeout(resolve, 2500);
    });
    recoveryChannels.set(conversationId, { channel: channel, own: own, info: info });
    return recoveryChannels.get(conversationId);
  }

  async function requestKeyRecovery(conversationId) {
    if (!conversationId || recoveryBusy.has(conversationId)) return;
    recoveryBusy.add(conversationId);
    try {
      var info = await identity();
      var own = await ownDevice(info);
      if (!own) throw new Error('DEVICE_NOT_FOUND');
      var rows = await rest('messages_v2?select=encryption_metadata&conversation_id=eq.' + encodeURIComponent(conversationId) + '&order=created_at.asc&limit=300');
      var versions = Array.from(new Set((rows || []).map(function (r) { return Number(r.encryption_metadata && r.encryption_metadata.key_version); }).filter(function (v) { return Number.isInteger(v) && v > 0; })));
      if (!versions.length) return;
      var ctx = await openRecoveryChannel(conversationId, info, own);
      if (!ctx || !ctx.channel) return;
      await ctx.channel.send({ type: 'broadcast', event: 'key-recovery-request', payload: { requesterUserId: info.userId, requesterDeviceId: own.id, requesterPublicKey: info.publicJwk, keyVersions: versions } });
      var notice = document.querySelector('[data-wa-key-recovery-notice]');
      if (!notice) {
        notice = document.createElement('div');
        notice.dataset.waKeyRecoveryNotice = '1';
        notice.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;padding:10px 12px;border-radius:12px;background:#fff3cd;border:1px solid #e6c76a;color:#5b4700;font:700 13px system-ui;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.12)';
        notice.textContent = 'Récupération sécurisée de l’historique en cours… Gardez cet appareil connecté.';
        document.body.appendChild(notice);
      }
      setTimeout(function () { recoveryBusy.delete(conversationId); }, 8000);
    } catch (e) {
      recoveryBusy.delete(conversationId);
      console.warn('[WASSAFRICA] key recovery request unavailable', e);
    }
  }

  function watchUnavailableMessages() {
    if (window.__WA_KEY_RECOVERY_OBSERVER) return;
    window.__WA_KEY_RECOVERY_OBSERVER = true;
    var observer = new MutationObserver(function () {
      if (!lastConversationId) return;
      var nodes = Array.from(document.querySelectorAll('#msgs .bubble'));
      if (nodes.some(function (n) { return /Message indisponible/i.test(n.textContent || ''); })) requestKeyRecovery(lastConversationId);
    });
    if (document.body) observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  function boot() {
    bindSearch();
    syncConversationContext();
    watchUnavailableMessages();
    if (!contextTimer) {
      contextTimer = setInterval(function () {
        bindSearch();
        syncConversationContext();
        watchUnavailableMessages();
      }, 250);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
