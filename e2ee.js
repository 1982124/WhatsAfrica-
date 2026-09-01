/* WhatsAfrica E2EE primitives.
 * This module deliberately does not claim a complete Signal/MLS protocol.
 * It provides audited Web Crypto building blocks for the next messaging layer:
 * AES-GCM payload encryption and RSA-OAEP key wrapping. Private keys stay local.
 */
(function(global){'use strict';
const te=new TextEncoder(),td=new TextDecoder();
function b64(bytes){let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s)}
function unb64(s){const x=atob(s);return Uint8Array.from(x,c=>c.charCodeAt(0))}
async function importAes(raw){return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function generateConversationKey(){return crypto.getRandomValues(new Uint8Array(32))}
async function encrypt(plaintext,rawKey,additionalData){const iv=crypto.getRandomValues(new Uint8Array(12)),key=await importAes(rawKey);const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:additionalData?te.encode(additionalData):undefined},key,te.encode(plaintext)));return {v:1,alg:'AES-256-GCM',iv:b64(iv),ciphertext:b64(ct)}}
async function decrypt(payload,rawKey,additionalData){if(!payload||payload.v!==1||payload.alg!=='AES-256-GCM')throw new Error('Payload chiffré non supporté');const key=await importAes(rawKey);const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(payload.iv),additionalData:additionalData?te.encode(additionalData):undefined},key,unb64(payload.ciphertext));return td.decode(pt)}
async function generateIdentity(){const k=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);return k}
async function exportJwk(key){return crypto.subtle.exportKey('jwk',key)}
async function importPublicJwk(jwk){return crypto.subtle.importKey('jwk',jwk,{name:'RSA-OAEP',hash:'SHA-256'},true,['encrypt'])}
async function wrapKey(rawKey,publicJwk){const k=await importPublicJwk(publicJwk);return b64(new Uint8Array(await crypto.subtle.encrypt({name:'RSA-OAEP'},k,rawKey)))}
async function unwrapKey(wrapped,privateKey){return new Uint8Array(await crypto.subtle.decrypt({name:'RSA-OAEP'},privateKey,unb64(wrapped)))}
global.WhatsAfricaCrypto={generateConversationKey,encrypt,decrypt,generateIdentity,exportJwk,wrapKey,unwrapKey};
})(window);
