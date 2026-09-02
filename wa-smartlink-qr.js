(() => {
  'use strict';

  const QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
  let qrReady;

  function loadQrLib() {
    if (window.QRCode?.toDataURL) return Promise.resolve();
    if (qrReady) return qrReady;
    qrReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = QR_LIB;
      s.async = true;
      s.onload = () => window.QRCode?.toDataURL ? resolve() : reject(new Error('QR library unavailable'));
      s.onerror = () => reject(new Error('Impossible de charger le générateur QR.'));
      document.head.appendChild(s);
    });
    return qrReady;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));
  }

  function ensureCard() {
    if (document.getElementById('smartLinkQrCard')) return document.getElementById('smartLinkQrCard');
    const button = document.getElementById('saveLink');
    if (!button) return null;
    const card = document.createElement('div');
    card.id = 'smartLinkQrCard';
    card.className = 'notice hidden';
    card.style.cssText = 'margin-top:14px;text-align:center;padding:18px;background:#0b1220;border:1px solid var(--line);border-radius:14px';
    card.innerHTML = `
      <div style="font-size:18px;font-weight:900">📱 Votre QR Code Smart Link</div>
      <p id="smartLinkQrUrl" class="muted" style="word-break:break-all;margin:8px 0 12px"></p>
      <div style="display:flex;justify-content:center;margin:10px 0 14px"><canvas id="smartLinkQrCanvas" width="240" height="240" style="width:240px;height:240px;max-width:100%;background:#fff;border-radius:12px;padding:8px"></canvas></div>
      <div class="row" style="justify-content:center">
        <button class="btn" type="button" id="smartLinkQrShare">↗️ Partager</button>
        <button class="btn ghost" type="button" id="smartLinkQrCopy">🔗 Copier le lien</button>
        <button class="btn ghost" type="button" id="smartLinkQrDownload">⬇️ Télécharger le QR</button>
        <a class="btn ghost" id="smartLinkQrOpen" target="_blank" rel="noopener">Ouvrir</a>
      </div>
      <p id="smartLinkQrMsg" class="muted" role="status" aria-live="polite"></p>`;
    button.closest('.card')?.appendChild(card);
    return card;
  }

  async function render(slug) {
    const clean = String(slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
    if (!clean) return;
    const card = ensureCard();
    if (!card) return;
    const url = new URL('/' + clean, location.origin).href;
    const canvas = document.getElementById('smartLinkQrCanvas');
    const urlEl = document.getElementById('smartLinkQrUrl');
    const msg = document.getElementById('smartLinkQrMsg');
    card.classList.remove('hidden');
    urlEl.textContent = url;
    document.getElementById('smartLinkQrOpen').href = url;
    msg.textContent = 'Génération du QR Code…';

    try {
      await loadQrLib();
      await window.QRCode.toCanvas(canvas, url, {
        width: 240,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#090d17', light: '#ffffff' }
      });
      msg.innerHTML = '<span class="ok">✓ QR Code prêt. Scannez-le pour ouvrir votre Smart Link.</span>';

      document.getElementById('smartLinkQrDownload').onclick = () => {
        const a = document.createElement('a');
        a.download = `whatsafrica-${clean}-qr.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      };
      document.getElementById('smartLinkQrCopy').onclick = async () => {
        try {
          await navigator.clipboard.writeText(url);
          msg.innerHTML = '<span class="ok">Lien copié.</span>';
        } catch (_) {
          msg.textContent = 'Copie non disponible sur cet appareil.';
        }
      };
      document.getElementById('smartLinkQrShare').onclick = async () => {
        try {
          if (navigator.share) {
            await navigator.share({ title: 'Mon Smart Link WhatsAfrica', text: 'Découvrez mon activité sur WhatsAfrica', url });
            return;
          }
          await navigator.clipboard.writeText(url);
          msg.innerHTML = '<span class="ok">Lien copié : vous pouvez maintenant le partager.</span>';
        } catch (_) {}
      };
    } catch (error) {
      msg.innerHTML = '<span class="err">QR indisponible pour le moment. Le Smart Link reste actif : ' + escapeHtml(url) + '</span>';
    }
  }

  function init() {
    const save = document.getElementById('saveLink');
    const slug = document.getElementById('slug');
    const status = document.getElementById('linkMsg');
    if (!save || !slug || !status) return;

    const observer = new MutationObserver(() => {
      if (/Smart Link actif/i.test(status.textContent || '')) render(slug.value);
    });
    observer.observe(status, { childList: true, subtree: true, characterData: true });

    save.addEventListener('click', () => setTimeout(() => {
      if (/Smart Link actif/i.test(status.textContent || '')) render(slug.value);
    }, 250));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
