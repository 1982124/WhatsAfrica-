/* WASSAFRICA — self-target guard. Must load before inbox runtime. */
(function(){'use strict';
const AUTH='whatsafrica-auth';
function currentUserId(){try{const raw=localStorage.getItem(AUTH);if(!raw)return null;const x=JSON.parse(raw),s=x?.access_token?x:x?.session||x?.currentSession||x?.data?.session;return s?.user?.id?String(s.user.id):null}catch{return null}}
const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
  try{
    const url=typeof input==='string'?input:(input?.url||'');
    if(url.includes('/rest/v1/rpc/start_direct_conversation_by_user_id') && init?.body){
      const body=JSON.parse(init.body), me=currentUserId(), target=body?.p_user_id;
      if(me&&target&&String(target)===me){
        return new Response(JSON.stringify({code:'CANNOT_MESSAGE_SELF',message:'Vous ne pouvez pas démarrer une conversation avec votre propre compte.'}),{status:400,headers:{'content-type':'application/json'}});
      }
    }
  }catch{}
  return nativeFetch(input,init);
};
window.WA_SELF_MESSAGE_GUARD=true;
})();