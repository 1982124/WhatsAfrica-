(() => {
  'use strict';
  if (window.WACurrency) return;
  const KEY = 'wa_display_currency_v1';
  const CURRENCIES = [
    ['XOF','Franc CFA BCEAO'],['XAF','Franc CFA BEAC'],['GHS','Cedi ghanéen'],['NGN','Naira nigérian'],
    ['KES','Shilling kényan'],['UGX','Shilling ougandais'],['TZS','Shilling tanzanien'],['ZAR','Rand sud-africain'],
    ['RWF','Franc rwandais'],['ETB','Birr éthiopien'],['EGP','Livre égyptienne'],['MAD','Dirham marocain'],
    ['DZD','Dinar algérien'],['TND','Dinar tunisien'],['ZMW','Kwacha zambien'],['MWK','Kwacha malawien'],
    ['BWP','Pula botswanais'],['NAD','Dollar namibien'],['MZN','Metical mozambicain'],['AOA','Kwanza angolais'],
    ['SLE','Leone sierra-léonais'],['LSL','Loti lésothan'],['SZL','Lilangeni swazi'],['LRD','Dollar libérien'],['GMD','Dalasi gambien'],['CVE','Escudo cap-verdien'],['MRU','Ouguiya mauritanien'],
    ['MUR','Roupie mauricienne'],['CDF','Franc congolais'],['BIF','Franc burundais'],['SOS','Shilling somalien'],
    ['USD','Dollar américain'],['EUR','Euro'],['GBP','Livre sterling'],['CAD','Dollar canadien'],
    ['AUD','Dollar australien'],['CHF','Franc suisse'],['CNY','Yuan chinois'],['INR','Roupie indienne'],
    ['AED','Dirham des Émirats'],['SAR','Riyal saoudien'],['JPY','Yen japonais'],['BRL','Real brésilien'],
    ['MAD','Dirham marocain'],['TRY','Livre turque'],['SGD','Dollar de Singapour'],['HKD','Dollar de Hong Kong'],
    ['PKR','Roupie pakistanaise'],['IDR','Roupie indonésienne'],['MYR','Ringgit malaisien'],['THB','Baht thaïlandais'],
    ['PHP','Peso philippin'],['MXN','Peso mexicain'],['NZD','Dollar néo-zélandais'],['KRW','Won sud-coréen']
  ];
  const ZERO_DECIMALS = new Set(['XOF','XAF','JPY','KRW','UGX','RWF','TZS','BIF','CDF','CLP']);
  let rates = null, target = null, sourceInfo = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (value, currency) => {
    try { return new Intl.NumberFormat('fr-FR', { style:'currency', currency, maximumFractionDigits: ZERO_DECIMALS.has(currency) ? 0 : 2 }).format(value); }
    catch { return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value) + ' ' + currency; }
  };
  function convert(amount, base, to) {
    const n = Number(amount), b = String(base || 'XOF').toUpperCase(), t = String(to || target || 'XOF').toUpperCase();
    if (!Number.isFinite(n) || !rates || !Number.isFinite(Number(rates[b])) || !Number.isFinite(Number(rates[t])) || Number(rates[b]) <= 0) return null;
    if (b === t) return n;
    return n / Number(rates[b]) * Number(rates[t]);
  }
  function ensureWidget() {
    if (document.getElementById('wa-currency-widget') || !document.body) return;
    const box = document.createElement('aside');
    box.id = 'wa-currency-widget';
    box.innerHTML = '<label for="wa-currency-select">Devise d’affichage</label><select id="wa-currency-select" aria-label="Choisir la devise d’affichage"></select><p id="wa-currency-note">Conversion automatique des prix</p>';
    const style = document.createElement('style');
    style.textContent = '#wa-currency-widget{position:fixed;right:14px;bottom:14px;z-index:9998;width:min(230px,calc(100vw - 28px));padding:11px 12px;background:#fffdf9;color:#18231e;border:1px solid #d9dfd8;border-radius:14px;box-shadow:0 8px 28px #152c2026;font:12px/1.4 system-ui,-apple-system,sans-serif}#wa-currency-widget label{display:block;font-weight:800;margin-bottom:5px}#wa-currency-select{width:100%;border:1px solid #d5ddd5;border-radius:9px;background:#fff;color:#18231e;padding:7px;font:inherit;font-weight:700}#wa-currency-note{margin:6px 0 0;color:#647067;font-size:10px} .wa-converted-price{display:block;margin-top:3px;color:#247343;font-size:.76em;font-weight:750;line-height:1.35} @media(max-width:480px){#wa-currency-widget{right:8px;bottom:8px;width:190px;padding:9px 10px}}';
    document.head.appendChild(style);
    document.body.appendChild(box);
    const select = box.querySelector('select');
    const supported = CURRENCIES.filter(([code], i, arr) => arr.findIndex(x => x[0] === code) === i);
    select.innerHTML = supported.map(([code, label]) => '<option value="' + esc(code) + '">' + esc(code + ' — ' + label) + '</option>').join('');
    select.addEventListener('change', () => {
      target = select.value;
      try { localStorage.setItem(KEY, target); } catch {}
      refresh();
      updateNote();
    });
  }
  function updateNote() {
    const note = document.getElementById('wa-currency-note');
    if (!note) return;
    note.textContent = rates
      ? 'Équivalent indicatif · le paiement reste dans la devise du vendeur.'
      : 'Taux indisponibles pour le moment · prix du vendeur conservé.';
  }
  function refresh() {
    if (!target) return;
    document.querySelectorAll('[data-wa-price][data-wa-currency]').forEach(el => {
      const amount = Number(el.getAttribute('data-wa-price'));
      const base = String(el.getAttribute('data-wa-currency') || 'XOF').toUpperCase();
      let label = el.nextElementSibling;
      if (!label || !label.classList.contains('wa-converted-price')) {
        label = document.createElement('small');
        label.className = 'wa-converted-price';
        label.setAttribute('aria-live','polite');
        el.insertAdjacentElement('afterend', label);
      }
      const converted = convert(amount, base, target);
      if (converted === null || base === target) {
        label.hidden = true;
        label.textContent = '';
      } else {
        label.hidden = false;
        label.textContent = '≈ ' + fmt(converted, target);
        label.title = 'Conversion indicative, calculée à partir du taux de change publié.';
      }
    });
  }
  async function init() {
    ensureWidget();
    let detected = null;
    try { const r = await fetch('/api/smartlink-import?__route=currency&action=detect', { headers:{Accept:'application/json'}, cache:'no-store' }); if (r.ok) detected = await r.json(); } catch {}
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch {}
    target = (saved && /^[A-Z]{3}$/.test(saved)) ? saved : (detected?.currency || 'XOF');
    sourceInfo = detected?.source || null;
    const select = document.getElementById('wa-currency-select');
    if (select) {
      if (![...select.options].some(o => o.value === target)) target = 'XOF';
      select.value = target;
    }
    try {
      const r = await fetch('/api/smartlink-import?__route=currency&action=rates', { headers:{Accept:'application/json'}, cache:'force-cache' });
      if (r.ok) { const data = await r.json(); if (data.ok && data.rates) rates = data.rates; }
    } catch {}
    refresh();
    updateNote();
  }
  window.WACurrency = { init, refresh, convert, get currency(){return target;} };
  const observePrices = () => { if (!document.body || window.__waCurrencyObserver) return; window.__waCurrencyObserver = new MutationObserver(records => { const addedPrice = records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches?.('[data-wa-price][data-wa-currency]') || node.querySelector?.('[data-wa-price][data-wa-currency]')))); if (addedPrice) refresh(); }); window.__waCurrencyObserver.observe(document.body, { childList:true, subtree:true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observePrices, {once:true}); else observePrices();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();