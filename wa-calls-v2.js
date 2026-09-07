/* WhatsAfrica — native telephone calls. Classic calls use the phone's own dialer; no WebRTC. */
(function(){'use strict';
const S={db:null,user:null};
async function start(conversationId,peerId,mode='audio'){
  if(!S.db||!S.user)throw Error('Session WhatsAfrica indisponible.');
  if(!conversationId)throw Error('Conversation introuvable.');
  const r=await S.db.rpc('get_direct_contact_phone',{p_conversation_id:conversationId});
  if(r.error)throw r.error;
  const phone=String(r.data||'').trim();
  if(!/^\+[1-9][0-9]{7,14}$/.test(phone))throw Error('Numéro du correspondant indisponible.');
  window.location.href='tel:'+phone;
}
function init(db,user){S.db=db;S.user=user;}
function end(){}
function toggleMic(){}
function toggleCam(){}
function share(){}
window.WA_CALLS={init,start,end,toggleMic,toggleCam,share};
})();