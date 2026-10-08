/* WASSAFRICA — Smart Link Audience Capture v3 */
(function () {
  'use strict';

  const SB = 'https://dzifpwqrqnvssfhwjccj.supabase.co';
  const KEY = 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
  let injected = false;

  function sessionId() {
    try {
      let value = localStorage.getItem('wa-smart-link-session-v1');
      if (!value) {
        value = crypto.randomUUID();
        localStorage.setItem('wa-smart-link-session-v1', value);
      }
      return value;
    } catch (_) {
      return '';
    }
  }

  function currentSlug() {
    const parts = location.pathname
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent);
    return parts[0] === 'smartlink' ? parts[1] : parts[0];
  }

  async function getLink() {
    const slug = currentSlug();
    if (!slug) return null;

    const url =
      SB +
      '/rest/v1/smart_links?select=id,business_id&slug=eq.' +
      encodeURIComponent(slug) +
      '&is_public=eq.true&limit=1';

    const response = await fetch(url, {
      headers: { apikey: KEY, Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('SMART_LINK_LOOKUP_' + response.status);
    }

    const rows = await response.json();
    return rows && rows[0] ? rows[0] : null;
  }

  function mount() {
    if (injected) return;

    const app = document.getElementById('app');
    if (!app) return;

    const anchor = Array.from(app.querySelectorAll('.section')).find(function (section) {
      const heading = section.querySelector('h2');
      return heading && heading.textContent.trim() === 'Votre parcours commercial';
    });

    if (!anchor) return;

    injected = true;

    const section = document.createElement('section');
    section.className = 'section wa-audience-section';
    section.innerHTML =
      '<div class="wa-audience-box">' +
        '<div class="wa-audience-ey">RESTEZ EN CONTACT</div>' +
        '<h2>Recevez nos nouveautés et offres</h2>' +
        '<p class="wa-audience-muted">Laissez votre email ou votre numéro WhatsApp. Vous choisissez comment WASSAFRICA peut vous recontacter.</p>' +
        '<form id="wa-audience-form" novalidate>' +
          '<div class="wa-audience-grid">' +
            '<label>Prénom <input name="name" maxlength="80" autocomplete="given-name" placeholder="Votre prénom"></label>' +
            '<label>Email <input name="email" type="email" maxlength="160" autocomplete="email" placeholder="vous@exemple.com"></label>' +
            '<label>WhatsApp <input name="phone" type="tel" maxlength="40" autocomplete="tel" inputmode="tel" placeholder="+223 …"></label>' +
            '<label>Canal préféré <select name="channel"><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></label>' +
          '</div>' +
          '<label class="wa-audience-consent"><input name="consent" type="checkbox" required> <span>J’accepte de recevoir des nouveautés et offres par le canal choisi.</span></label>' +
          '<input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="wa-audience-honeypot">' +
          '<button class="btn primary" type="submit">Recevoir les nouveautés</button>' +
          '<div id="wa-audience-status" class="wa-audience-status" role="status" aria-live="polite"></div>' +
        '</form>' +
      '</div>';

    anchor.before(section);

    const form = section.querySelector('form');
    const status = section.querySelector('#wa-audience-status');
    const button = form.querySelector('button');

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      status.textContent = '';
      status.className = 'wa-audience-status';

      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim().toLowerCase();
      const phone = String(data.get('phone') || '').trim();
      const channel = String(data.get('channel') || 'email');
      const consent = data.get('consent') === 'on';

      if (data.get('website')) return;

      if (!email && !phone) {
        status.textContent = 'Ajoutez un email ou un numéro WhatsApp.';
        status.classList.add('error');
        return;
      }

      if (channel === 'email' && !email) {
        status.textContent = 'Ajoutez votre email pour choisir ce canal.';
        status.classList.add('error');
        return;
      }

      if (channel === 'whatsapp' && !phone) {
        status.textContent = 'Ajoutez votre numéro WhatsApp pour choisir ce canal.';
        status.classList.add('error');
        return;
      }

      if (!consent) {
        status.textContent = 'Votre accord est nécessaire pour la relance.';
        status.classList.add('error');
        return;
      }

      button.disabled = true;
      button.textContent = 'Enregistrement…';

      try {
        const link = await getLink();
        if (!link) throw new Error('LINK_NOT_FOUND');

        const current = new URL(location.href);
        const payload = {
          business_id: link.business_id,
          smart_link_id: link.id,
          contact_name: name || null,
          contact_email: email || null,
          contact_phone: phone || null,
          preferred_channel: channel,
          email_opt_in: channel === 'email' && !!email,
          whatsapp_opt_in: channel === 'whatsapp' && !!phone,
          consent_at: new Date().toISOString(),
          visitor_hash: sessionId() || null,
          source: 'smart_link_capture',
          utm_source: current.searchParams.get('utm_source') || null,
          utm_medium: current.searchParams.get('utm_medium') || null,
          utm_campaign: current.searchParams.get('utm_campaign') || null,
          referrer: document.referrer.slice(0, 240),
          status: 'new'
        };

        const response = await fetch(SB + '/rest/v1/leads', {
          method: 'POST',
          headers: {
            apikey: KEY,
            Authorization: 'Bearer ' + KEY,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'CAPTURE_' + response.status);
        }

        try {
          if (window.WA_SMART_LINK && typeof window.WA_SMART_LINK.track === 'function') {
            window.WA_SMART_LINK.track('smart_link_lead_captured', {
              smart_link_id: link.id,
              channel: channel,
              lead_source: 'smart_link_capture'
            });
          }
        } catch (_) {}

        form.reset();
        status.textContent = 'C’est enregistré. Vous recevrez les prochaines nouvelles sur le canal choisi.';
        status.classList.add('success');
      } catch (error) {
        console.error('[WassAfrica] audience capture', error);
        status.textContent = 'Impossible d’enregistrer votre demande pour le moment. Réessayez dans un instant.';
        status.classList.add('error');
      } finally {
        button.disabled = false;
        button.textContent = 'Recevoir les nouveautés';
      }
    });
  }

  function boot() {
    const app = document.getElementById('app');
    if (!app) return;

    mount();

    if (!injected) {
      new MutationObserver(function () {
        mount();
      }).observe(app, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
