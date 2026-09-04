/* WhatsAfrica E2EE client core
 * Protocol v1: RSA-OAEP-256 device envelopes + AES-256-GCM message payloads.
 * Private material stays on-device. This is a transport/storage crypto primitive,
 * not a claim of Signal-protocol certification.
 */
(function(){
  'use strict';
  const VERSION=1, ALGORITHM='RSA-OAEP-256+A256GCM';
  const enc=new TextEncoder(), dec=new TextDecoder();
  const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
  const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const keyName=u=>`whatsafrica:e2ee:device:${u}`;
  async function generateDevice(){
    const pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
    return {publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey),privateKey:await crypto.subtle.exportKey('jwk',pair.privateKey)};
  }
  async function importPublic(jwk){return crypto.subtle.importKey('jwk',jwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);}
  async function importPrivate(jwk){return crypto.subtle.importKey('jwk',jwk,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);}
  async function ensureDevice(db,userId,label='WhatsAfrica Web'){
    const local=localStorage.getItem(keyName(userId));
    let material=local?JSON.parse(local):null;
    if(!material){material=await generateDevice();localStorage.setItem(keyName(userId),JSON.stringify(material));}
    const pub=material.publicKey;
    const existing=await db.from('user_devices').select('id,identity_public_key,revoked_at').eq('user_id',userId).eq('device_label',label).maybeSingle();
    if(existing.error)throw existing.error;
    if(existing.data && !existing.data.revoked_at){
      if(JSON.stringify(existing.data.identity_public_key)!==JSON.stringify(pub)){
        const up=await db.from('user_devices').update({identity_public_key:pub,last_seen_at:new Date().toISOString()}).eq('id',existing.data.id).eq('user_id',userId);if(up.error)throw up.error;
      }
      return {id:existing.data.id,material};
    }
    const ins=await db.from('user_devices').insert({user_id:userId,device_label:label,identity_public_key:pub}).select('id').single();
    if(ins.error)throw ins.error;
    return {id:ins.data.id,material};
  }
  async function encryptText(aesKey,text,aad){
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad?enc.encode(aad):undefined},aesKey,enc.encode(text));
    return {ciphertext:b64(cipher),metadata:{version:VERSION,algorithm:ALGORITHM,iv:b64(iv),aad:aad||null}};
  }
  async function decryptText(aesKey,ciphertext,metadata){
    const iv=unb64(metadata.iv),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:metadata.aad?enc.encode(metadata.aad):undefined},aesKey,unb64(ciphertext));
    return dec.decode(plain);
  }
  async function newConversationKey(){return crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);}
  async function wrapConversationKey(aesKey,publicJwk){
    const raw=await crypto.subtle.exportKey('raw',aesKey),pub=await importPublic(publicJwk);
    const wrapped=await crypto.subtle.encrypt({name:'RSA-OAEP'},pub,raw);return b64(wrapped);
  }
  async function unwrapConversationKey(wrapped,privateJwk){
    const priv=await importPrivate(privateJwk),raw=await crypto.subtle.decrypt({name:'RSA-OAEP'},priv,unb64(wrapped));
    return crypto.subtle.importKey('raw',raw,{name:'AES-GCM',length:256},true,['encrypt','decrypt']);
  }
  async function provisionConversationKey(db,conversationId,userId,device){
    const own=await db.from('conversation_key_envelopes').select('wrapped_key,key_version,algorithm').eq('conversation_id',conversationId).eq('device_id',device.id).is('revoked_at',null).order('key_version',{ascending:false}).limit(1).maybeSingle();
    if(own.error)throw own.error;
    if(own.data){return unwrapConversationKey(own.data.wrapped_key,device.material.privateKey);}
    const members=await db.from('conversation_members').select('user_id').eq('conversation_id',conversationId);if(members.error)throw members.error;
    const ids=[...new Set((members.data||[]).map(x=>x.user_id))];
    const devices=[];
    for(const id of ids){const r=await db.from('user_devices').select('id,user_id,identity_public_key').eq('user_id',id).is('revoked_at',null);if(r.error)throw r.error;devices.push(...(r.data||[]));}
    const key=await newConversationKey();
    for(const d of devices){
      const wrapped=await wrapConversationKey(key,d.identity_public_key);
      const row={conversation_id:conversationId,device_id:d.id,key_version:1,algorithm:ALGORITHM,wrapped_key:wrapped};
      const ins=await db.from('conversation_key_envelopes').upsert(row,{onConflict:'conversation_id,device_id,key_version',ignoreDuplicates:true});
      if(ins.error)throw ins.error;
    }
    const own2=await db.from('conversation_key_envelopes').select('wrapped_key').eq('conversation_id',conversationId).eq('device_id',device.id).eq('key_version',1).is('revoked_at',null).maybeSingle();
    if(own2.error||!own2.data)throw own2.error||new Error('Impossible de provisionner la clé de conversation.');
    return unwrapConversationKey(own2.data.wrapped_key,device.material.privateKey);
  }
  window.WhatsAfricaE2EE={VERSION,ALGORITHM,ensureDevice,provisionConversationKey,encryptText,decryptText,wrapConversationKey,unwrapConversationKey,newConversationKey};
})();