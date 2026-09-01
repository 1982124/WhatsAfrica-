/* WhatsAfrica E2EE primitives — v1 foundation.
 * Private identity material is designed to remain local. The server stores public keys
 * and opaque ciphertext only. This is NOT a Signal/MLS implementation yet.
 */
(function(global){'use strict';
const te=new TextEncoder(),td=new TextDecoder();
const DB_NAME='whatsafrica-crypto',DB_VERSION=1,STORE='keys';
function b64(bytes){let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s)}
function unb64(s){const x=atob(s);return Uint8Array.from(x,c=>c.charCodeAt(0))}
async function importAes(raw){return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function generateConversationKey(){return crypto.getRandomValues(new Uint8Array(32))}
async function encrypt(plaintext,rawKey,additionalData){if(typeof plaintext!=='string')throw new TypeError('plaintext doit être une chaîne');const iv=crypto.getRandomValues(new Uint8Array(12)),key=await importAes(rawKey),aad=additionalData?te.encode(additionalData):undefined;const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,te.encode(plaintext)));return {v:1,alg:'AES-256-GCM',iv:b64(iv),ciphertext:b64(ct)}}
async function decrypt(payload,rawKey,additionalData){if(!payload||payload.v!==1||payload.alg!=='AES-256-GCM')throw new Error('Payload chiffré non supporté');const key=await importAes(rawKey),aad=additionalData?te.encode(additionalData):undefined;const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(payload.iv),additionalData:aad},key,unb64(payload.ciphertext));return td.decode(pt)}
async function generateIdentity(){return crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt'])}
async function exportJwk(key){return crypto.subtle.exportKey('jwk',key)}
async function importPublicJwk(jwk){return crypto.subtle.importKey('jwk',jwk,{name:'RSA-OAEP',hash:'SHA-256'},true,['encrypt'])}
async function wrapKey(rawKey,publicJwk){const k=await importPublicJwk(publicJwk);return b64(new Uint8Array(await crypto.subtle.encrypt({name:'RSA-OAEP'},k,rawKey)))}
async function unwrapKey(wrapped,privateKey){return new Uint8Array(await crypto.subtle.decrypt({name:'RSA-OAEP'},privateKey,unb64(wrapped)))}
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function vaultPut(name,value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,name);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function vaultGet(name){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(name);r.onsuccess=()=>{db.close();resolve(r.result??null)};r.onerror=()=>{db.close();reject(r.error)}})}
async function getOrCreateIdentity(){let saved=await vaultGet('identity-jwk');if(saved&&saved.privateJwk&&saved.publicJwk){return {publicJwk:saved.publicJwk,privateKey:await crypto.subtle.importKey('jwk',saved.privateJwk,{name:'RSA-OAEP',hash:'SHA-256'},true,['decrypt'])}}const pair=await generateIdentity(),publicJwk=await exportJwk(pair.publicKey),privateJwk=await exportJwk(pair.privateKey);await vaultPut('identity-jwk',{v:1,publicJwk,privateJwk});return {publicJwk,privateKey:pair.privateKey}}
function makeEnvelope(conversationId,encrypted){if(!conversationId||!encrypted?.ciphertext)throw new Error('Envelope invalide');return {encryption_version:1,ciphertext:encrypted.ciphertext,encryption_metadata:{v:1,alg:encrypted.alg,iv:encrypted.iv,conversation_id:conversationId}}}
async function createEncryptedMessageEnvelope(text,conversationId,rawKey){return makeEnvelope(conversationId,await encrypt(text,rawKey,`whatsafrica:v1:${conversationId}`))}
async function decryptMessageEnvelope(row,rawKey){if(!row||row.encryption_version!==1)throw new Error('Message non E2EE');const m=row.encryption_metadata||{};return decrypt({v:1,alg:m.alg,iv:m.iv,ciphertext:row.ciphertext},rawKey,`whatsafrica:v1:${m.conversation_id}`)}
global.WhatsAfricaCrypto={generateConversationKey,encrypt,decrypt,generateIdentity,exportJwk,wrapKey,unwrapKey,getOrCreateIdentity,createEncryptedMessageEnvelope,decryptMessageEnvelope,vaultPut,vaultGet};
})(window);
