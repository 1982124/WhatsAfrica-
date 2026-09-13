/* WASSAFRICA — appels 1:1 WebRTC avec signalisation Supabase. */
(function () {
  'use strict';

  const S = {
    db: null, user: null, inboxChannel: null, signalChannel: null, sessionChannel: null,
    pc: null, callId: null, peerId: null, mode: 'audio', local: null,
    remoteVideo: null, remoteAudio: null, modal: null, accepted: false,
    offerSent: false, iceQueue: [], startedAt: 0, timer: null
  };
  const STUN = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  const cleanupChannel = (channel) => {
    if (channel) S.db?.removeChannel(channel).catch(() => {});
    return null;
  };

  function ensureModal() {
    if (S.modal) return S.modal;
    const d = document.createElement('div');
    d.id = 'waCallModal';
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(8,13,10,.96);display:none;align-items:center;justify-content:center;padding:10px;font-family:system-ui,-apple-system,sans-serif;';
    d.innerHTML = `
      <div style="width:min(760px,100%);height:min(92vh,820px);display:flex;flex-direction:column;background:#111;color:#fff;border-radius:24px;overflow:hidden;box-shadow:0 25px 90px rgba(0,0,0,.4)">
        <header style="display:flex;align-items:center;gap:10px;padding:13px 15px;background:#161816">
          <div style="min-width:0;flex:1"><b id="waCallTitle" style="display:block;font-size:16px">Appel WASSAFRICA</b><span id="waCallStatus" style="color:#aeb8b0;font-size:12px"></span></div>
          <span id="waCallTimer" style="font-variant-numeric:tabular-nums;color:#dfe6e0;font-size:12px"></span>
        </header>
        <div id="waCallStage" style="position:relative;flex:1;min-height:240px;background:#050605;display:grid;place-items:center;overflow:hidden">
          <div id="waAudioAvatar" style="width:100px;height:100px;border-radius:50%;display:grid;place-items:center;background:#e6a336;color:#211805;font-size:34px">👤</div>
          <video id="waCallRemoteVideo" autoplay playsinline style="display:none;width:100%;height:100%;object-fit:cover;background:#050605"></video>
          <audio id="waCallRemoteAudio" autoplay></audio>
          <div id="waCallLocalWrap" style="display:none;position:absolute;right:12px;top:12px;width:min(30%,190px);aspect-ratio:3/4;border-radius:15px;overflow:hidden;border:1px solid #56635a;background:#171a18;box-shadow:0 10px 30px rgba(0,0,0,.35)">
            <video id="waCallLocalVideo" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>
          </div>
        </div>
        <div id="waIncomingActions" style="display:none;gap:9px;padding:14px;background:#161816">
          <button id="waAccept" style="flex:1;border:0;border-radius:14px;padding:13px;font-weight:900;background:#39c98a;color:#07150e">Accepter</button>
          <button id="waReject" style="flex:1;border:0;border-radius:14px;padding:13px;font-weight:900;background:#ef6a64;color:#240a08">Refuser</button>
        </div>
        <div id="waCallActions" style="display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;background:#161816">
          <button id="waMute" aria-label="Couper le micro" style="width:50px;height:50px;border:1px solid #394039;background:#202520;color:#fff;border-radius:50%;font-size:19px">🎙️</button>
          <button id="waCam" aria-label="Activer la caméra" style="width:50px;height:50px;border:1px solid #394039;background:#202520;color:#fff;border-radius:50%;font-size:19px">📹</button>
          <button id="waHangup" aria-label="Raccrocher" style="width:58px;height:58px;border:0;background:#e85c56;color:#fff;border-radius:50%;font-size:21px;transform:rotate(135deg)">📞</button>
        </div>
        <div style="padding:0 14px 12px;background:#161816;color:#8f9a92;font-size:11px;text-align:center">📶 Appel Internet · Wi‑Fi ou données mobiles · micro/caméra du téléphone</div>
      </div>`;
    document.body.appendChild(d);
    S.modal = d;
    d.querySelector('#waAccept').onclick = () => acceptIncoming().catch(showError);
    d.querySelector('#waReject').onclick = () => rejectIncoming().catch(showError);
    d.querySelector('#waHangup').onclick = () => end().catch(showError);
    d.querySelector('#waMute').onclick = toggleMic;
    d.querySelector('#waCam').onclick = toggleCam;
    return d;
  }

  function showModal(title, status, incoming) {
    const m = ensureModal();
    m.style.display = 'flex';
    m.querySelector('#waCallTitle').textContent = title || 'Appel WASSAFRICA';
    m.querySelector('#waCallStatus').textContent = status || '';
    m.querySelector('#waIncomingActions').style.display = incoming ? 'flex' : 'none';
    m.querySelector('#waCallActions').style.display = incoming ? 'none' : 'flex';
    m.querySelector('#waCallTimer').textContent = '';
    return m;
  }

  function setStatus(text) {
    if (S.modal) S.modal.querySelector('#waCallStatus').textContent = text;
  }

  function showError(error) {
    console.error('WASSAFRICA call', error);
    setStatus(error?.message || 'Appel impossible');
  }

  function startTimer() {
    clearInterval(S.timer);
    S.startedAt = Date.now();
    const tick = () => {
      if (!S.modal) return;
      const seconds = Math.max(0, Math.floor((Date.now() - S.startedAt) / 1000));
      const minutes = Math.floor(seconds / 60);
      const rest = seconds % 60;
      S.modal.querySelector('#waCallTimer').textContent = `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
    };
    tick();
    S.timer = setInterval(tick, 1000);
  }

  function stopTimer() {
    clearInterval(S.timer);
    S.timer = null;
    S.startedAt = 0;
  }

  async function media() {
    if (!window.isSecureContext) throw Error('Les appels nécessitent une connexion HTTPS.');
    if (!navigator.mediaDevices?.getUserMedia) throw Error('Les appels audio/vidéo ne sont pas pris en charge par ce navigateur.');
    return navigator.mediaDevices.getUserMedia({ audio: true, video: S.mode === 'video' });
  }

  function createPeer() {
    const pc = new RTCPeerConnection({ iceServers: STUN });
    S.pc = pc;
    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal('ice', { candidate: event.candidate.toJSON?.() || event.candidate }).catch(showError);
    };
    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (!stream) return;
      if (event.track.kind === 'video') {
        S.remoteVideo.srcObject = stream;
        S.remoteVideo.style.display = 'block';
        S.modal.querySelector('#waAudioAvatar').style.display = 'none';
        S.remoteVideo.play().catch(() => {});
      } else {
        S.remoteAudio.srcObject = stream;
        S.remoteAudio.play().catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setStatus('Connecté');
        startTimer();
      } else if (['failed', 'disconnected'].includes(pc.connectionState)) {
        setStatus('Connexion réseau interrompue');
      } else if (pc.connectionState === 'closed') {
        setStatus('Appel terminé');
      }
    };
    return pc;
  }

  async function prepareMedia() {
    S.local = await media();
    const modal = ensureModal();
    S.remoteVideo = modal.querySelector('#waCallRemoteVideo');
    S.remoteAudio = modal.querySelector('#waCallRemoteAudio');
    const wrap = modal.querySelector('#waCallLocalWrap');
    const localVideo = modal.querySelector('#waCallLocalVideo');
    localVideo.srcObject = S.local;
    wrap.style.display = S.mode === 'video' ? 'block' : 'none';
    modal.querySelector('#waCam').style.display = S.mode === 'video' ? 'grid' : 'none';
    for (const track of S.local.getTracks()) S.pc.addTrack(track, S.local);
  }

  async function sendSignal(kind, payload) {
    if (!S.callId || !S.db || !S.user) return;
    const result = await S.db.from('call_signals').insert({ call_id: S.callId, sender_id: S.user.id, kind, payload });
    if (result.error) throw result.error;
  }

  async function flushIce() {
    if (!S.pc?.remoteDescription || !S.iceQueue.length) return;
    const queue = S.iceQueue.splice(0);
    for (const candidate of queue) {
      try { await S.pc.addIceCandidate(candidate); } catch (error) { console.warn('WASSAFRICA ICE', error); }
    }
  }

  async function loadPendingSignals() {
    if (!S.callId) return;
    const result = await S.db.from('call_signals').select('id,sender_id,kind,payload,created_at').eq('call_id', S.callId).neq('sender_id', S.user.id).order('created_at', { ascending: true }).limit(100);
    if (result.error) throw result.error;
    for (const signal of result.data || []) await handleSignal(signal);
  }

  async function handleSignal(signal) {
    if (!S.pc || signal.sender_id === S.user.id) return;
    try {
      if (signal.kind === 'offer') {
        await S.pc.setRemoteDescription(signal.payload);
        await flushIce();
        const answer = await S.pc.createAnswer();
        await S.pc.setLocalDescription(answer);
        await sendSignal('answer', { type: answer.type, sdp: answer.sdp });
      } else if (signal.kind === 'answer') {
        if (!S.pc.currentRemoteDescription) {
          await S.pc.setRemoteDescription(signal.payload);
          await flushIce();
        }
      } else if (signal.kind === 'ice') {
        if (S.pc.remoteDescription) await S.pc.addIceCandidate(signal.payload.candidate);
        else S.iceQueue.push(signal.payload.candidate);
      } else if (signal.kind === 'hangup' || signal.kind === 'reject') {
        await end(false);
      }
    } catch (error) {
      showError(error);
    }
  }

  function subscribeSignals() {
    S.signalChannel = cleanupChannel(S.signalChannel);
    S.signalChannel = S.db.channel(`wa-call-signals-${S.callId}`).on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'call_signals', filter: `call_id=eq.${S.callId}`
    }, (payload) => handleSignal(payload.new).catch(showError)).subscribe();
  }

  function subscribeSession() {
    S.sessionChannel = cleanupChannel(S.sessionChannel);
    S.sessionChannel = S.db.channel(`wa-call-session-${S.callId}`).on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'call_sessions', filter: `id=eq.${S.callId}`
    }, (payload) => {
      const state = payload.new;
      if (state.status === 'accepted' && !S.accepted) {
        S.accepted = true;
        startOffer().catch(showError);
      } else if (['ended', 'rejected', 'missed', 'cancelled', 'failed'].includes(state.status)) {
        end(false).catch(() => {});
      }
    }).subscribe();
  }

  async function syncSessionState() {
    if (!S.callId || !S.db) return;
    const result = await S.db.from('call_sessions').select('status,expires_at').eq('id', S.callId).maybeSingle();
    if (result.error || !result.data) return;
    if (['ended', 'rejected', 'missed', 'cancelled', 'failed'].includes(result.data.status)) return end(false);
    if (result.data.status === 'accepted' && !S.accepted) {
      S.accepted = true;
      await startOffer();
    }
  }

  async function startOffer() {
    if (!S.pc || S.offerSent) return;
    S.offerSent = true;
    setStatus('Connexion…');
    try {
      const offer = await S.pc.createOffer();
      await S.pc.setLocalDescription(offer);
      await sendSignal('offer', { type: offer.type, sdp: offer.sdp });
    } catch (error) {
      S.offerSent = false;
      throw error;
    }
  }

  async function createSession(conversationId, peerId, mode) {
    const result = await S.db.from('call_sessions').insert({
      conversation_id: conversationId, initiator_id: S.user.id, status: 'ringing',
      media_mode: mode === 'video' ? 'audio_video' : 'audio',
      expires_at: new Date(Date.now() + 120000).toISOString()
    }).select('id').single();
    if (result.error) throw result.error;
    S.callId = result.data.id;
    S.peerId = peerId;
    const participants = await S.db.from('call_participants').insert([
      { call_id: S.callId, user_id: S.user.id, role: 'initiator' },
      { call_id: S.callId, user_id: peerId, role: 'participant' }
    ]);
    if (participants.error) throw participants.error;
    const inbox = await S.db.from('call_inbox').insert({ call_id: S.callId, recipient_id: peerId, sender_id: S.user.id, status: 'ringing' });
    if (inbox.error) throw inbox.error;
  }

  async function start(conversationId, peerId, mode) {
    if (!S.db || !S.user) throw Error('Connectez-vous pour appeler.');
    if (!conversationId || !peerId) throw Error('Conversation introuvable.');
    if (!window.RTCPeerConnection) throw Error('Les appels Internet ne sont pas disponibles sur cet appareil.');
    if (S.pc) await end(false);
    S.mode = mode === 'video' ? 'video' : 'audio';
    S.accepted = false;
    S.offerSent = false;
    S.iceQueue = [];
    showModal(S.mode === 'video' ? '📹 Appel vidéo' : '📞 Appel audio', 'Sonnerie…', false);
    createPeer();
    await prepareMedia();
    await createSession(conversationId, peerId, S.mode);
    subscribeSignals();
    subscribeSession();
    await syncSessionState();
    if (S.callId) setStatus(S.accepted ? 'Connexion…' : 'Sonnerie chez votre contact…');
  }

  async function acceptIncoming() {
    if (!S.callId) return;
    S.accepted = true;
    const inbox = await S.db.from('call_inbox').update({ status: 'accepted', seen_at: new Date().toISOString() }).eq('call_id', S.callId).eq('recipient_id', S.user.id);
    if (inbox.error) throw inbox.error;
    const session = await S.db.from('call_sessions').update({ status: 'accepted', answered_at: new Date().toISOString() }).eq('id', S.callId);
    if (session.error) throw session.error;
    S.mode = S.mode === 'video' ? 'video' : 'audio';
    const modal = ensureModal();
    modal.querySelector('#waIncomingActions').style.display = 'none';
    modal.querySelector('#waCallActions').style.display = 'flex';
    createPeer();
    await prepareMedia();
    subscribeSignals();
    await loadPendingSignals();
    setStatus('Connexion…');
  }

  async function rejectIncoming() {
    if (!S.callId) return;
    await sendSignal('reject', {}).catch(() => {});
    const inbox = await S.db.from('call_inbox').update({ status: 'rejected', seen_at: new Date().toISOString() }).eq('call_id', S.callId).eq('recipient_id', S.user.id);
    if (inbox.error) throw inbox.error;
    const session = await S.db.from('call_sessions').update({ status: 'rejected', ended_at: new Date().toISOString() }).eq('id', S.callId);
    if (session.error) throw session.error;
    await end(false);
  }

  async function end(update) {
    const shouldUpdate = update !== false;
    if (S.callId && S.db && S.user) {
      if (S.pc) await sendSignal('hangup', {}).catch(() => {});
      if (shouldUpdate) await S.db.from('call_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', S.callId).eq('initiator_id', S.user.id).catch(() => {});
      if (shouldUpdate) await S.db.from('call_inbox').update({ status: 'cancelled', seen_at: new Date().toISOString() }).eq('call_id', S.callId).eq('sender_id', S.user.id).catch(() => {});
    }
    S.local?.getTracks().forEach((track) => track.stop());
    S.local = null;
    S.pc?.close();
    S.pc = null;
    S.signalChannel = cleanupChannel(S.signalChannel);
    S.sessionChannel = cleanupChannel(S.sessionChannel);
    S.callId = null;
    S.peerId = null;
    S.accepted = false;
    S.offerSent = false;
    S.iceQueue = [];
    stopTimer();
    hideModal();
  }

  function hideModal() {
    if (S.modal) S.modal.style.display = 'none';
  }

  function toggleMic() {
    if (!S.local) return;
    const track = S.local.getAudioTracks()[0];
    if (track) track.enabled = !track.enabled;
    if (S.modal) {
      S.modal.querySelector('#waMute').textContent = track?.enabled ? '🎙️' : '🔇';
      S.modal.querySelector('#waMute').setAttribute('aria-label', track?.enabled ? 'Couper le micro' : 'Activer le micro');
    }
  }

  function toggleCam() {
    if (!S.local || S.mode !== 'video') return;
    const track = S.local.getVideoTracks()[0];
    if (track) track.enabled = !track.enabled;
    if (S.modal) {
      S.modal.querySelector('#waCam').textContent = track?.enabled ? '📹' : '🚫';
      S.modal.querySelector('#waCam').setAttribute('aria-label', track?.enabled ? 'Couper la caméra' : 'Activer la caméra');
    }
  }

  async function showIncoming(item) {
    if (!item || item.status !== 'ringing' || S.callId) return false;
    const result = await S.db.from('call_sessions').select('id,media_mode,initiator_id,conversation_id,expires_at,status').eq('id', item.call_id).maybeSingle();
    if (result.error || !result.data) return false;
    if (result.data.status !== 'ringing') return false;
    if (result.data.expires_at && new Date(result.data.expires_at).getTime() <= Date.now()) return false;
    S.callId = result.data.id;
    S.peerId = result.data.initiator_id;
    S.mode = result.data.media_mode === 'audio_video' ? 'video' : 'audio';
    S.offerSent = false;
    S.iceQueue = [];
    showModal(S.mode === 'video' ? '📹 Appel vidéo entrant' : '📞 Appel audio entrant', 'Votre contact vous appelle', true);
    subscribeSignals();
    subscribeSession();
    return true;
  }

  async function recoverPending() {
    if (!S.db || !S.user || S.callId) return;
    const result = await S.db.from('call_inbox').select('call_id,status,created_at').eq('recipient_id', S.user.id).eq('status', 'ringing').order('created_at', { ascending: false }).limit(10);
    if (result.error) throw result.error;
    for (const item of result.data || []) if (await showIncoming(item)) break;
  }

  async function watchInbox() {
    if (!S.db || !S.user || S.inboxChannel) return;
    await recoverPending();
    S.inboxChannel = S.db.channel(`wa-call-inbox-${S.user.id}`).on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'call_inbox', filter: `recipient_id=eq.${S.user.id}`
    }, async (payload) => {
      try { await showIncoming(payload.new); } catch (error) { showError(error); }
    }).subscribe();
  }

  function init(db, user) {
    S.db = db;
    S.user = user;
    ensureModal();
    watchInbox().catch(showError);
  }

  window.WA_CALLS = {
    init,
    start,
    end,
    toggleMic,
    toggleCam,
    share: () => setStatus('Partage d’écran indisponible pour le moment.')
  };
}());
