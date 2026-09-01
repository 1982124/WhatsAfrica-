/* WhatsAfrica — localization foundation: FR / EN / SW / AR, with RTL support. */
(function(){
'use strict';
const DICTS={fr:{},en:{},sw:{},ar:{}};
const RTL=new Set(['ar']);
function locale(){const saved=localStorage.getItem('wa-locale');if(saved&&DICTS[saved])return saved;const n=(navigator.language||'fr').toLowerCase();if(n.startsWith('ar'))return'ar';if(n.startsWith('sw'))return'sw';if(n.startsWith('en'))return'en';return'fr'}
function setLocale(l){if(!DICTS[l])throw new Error('Locale indisponible');localStorage.setItem('wa-locale',l);document.documentElement.lang=l;document.documentElement.dir=RTL.has(l)?'rtl':'ltr';return l}
function t(key,fallback){const l=locale();return DICTS[l][key]??DICTS.fr[key]??fallback??key}
function register(localeCode,dict){if(!DICTS[localeCode])return;Object.assign(DICTS[localeCode],dict)}
window.WA_I18N={locale,setLocale,t,register,supported:Object.keys(DICTS)};
setLocale(locale());
})();
