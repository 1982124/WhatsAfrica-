/* WASSAFRICA — Supabase guard for private account routes.
 * Client-side navigation guard only; database authorization must remain enforced by RLS.
 * Public product pages, Smart Links, shared previews and guest messaging are intentionally excluded.
 */
(() => {
  'use strict';
  if (window.__WA_AUTH_GUARD_STARTED__) return;
  window.__WA_AUTH_GUARD_STARTED__ = true;

  const SUPABASE_URL = 'https://dzifpwqrqnvssfhwjccj.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
  const STORAGE_KEY = 'whatsafrica-auth';
  const AUTH_PATH = '/auth';

  function safeNext() {
    const path = window.location.pathname + window.location.search + window.location.hash;
    try {
      const target = new URL(path, window.location.origin);
      if (target.origin !== window.location.origin || target.pathname === AUTH_PATH) return '/dashboard';
      return target.pathname + target.search + target.hash;
    } catch (_) {
      return '/dashboard';
    }
  }

  function loadSupabase() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return Promise.resolve(window.supabase);
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = () => window.supabase ? resolve(window.supabase) : reject(new Error('SUPABASE_SDK_UNAVAILABLE'));
      script.onerror = () => reject(new Error('SUPABASE_SDK_UNAVAILABLE'));
      document.head.appendChild(script);
    });
  }

  function showUnavailable() {
    const render = () => {
      document.body.innerHTML = '';
      const main = document.createElement('main');
      main.setAttribute('role', 'alert');
      main.style.cssText = 'min-height:100vh;display:grid;place-items:center;padding:24px;background:#071b16;color:#f5f7f3;font:16px system-ui,sans-serif';
      const card = document.createElement('section');
      card.style.cssText = 'max-width:520px;background:#f7f1df;color:#17211d;padding:28px;border-radius:20px';
      const title = document.createElement('h1');
      title.textContent = 'Vérification de sécurité indisponible';
      const detail = document.createElement('p');
      detail.textContent = 'WASSAFRICA ne peut pas vérifier votre session pour le moment. Vos données restent protégées. Réessayez lorsque la connexion sera rétablie.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Réessayer';
      retry.style.cssText = 'padding:12px 18px;border:0;border-radius:10px;background:#21784c;color:white;font-weight:800;cursor:pointer';
      retry.onclick = () => window.location.reload();
      card.append(title, detail, retry);
      main.appendChild(card);
      document.body.appendChild(main);
    };
    if (document.body) render();
    else document.addEventListener('DOMContentLoaded', render, { once: true });
  }

  (async () => {
    try {
      // Migrate the legacy Supabase storage key only when the canonical key is absent.
      try {
        if (!localStorage.getItem(STORAGE_KEY)) {
          const legacy = localStorage.getItem('sb-dzifpwqrqnvssfhwjccj-auth-token');
          if (legacy) localStorage.setItem(STORAGE_KEY, legacy);
        }
      } catch (_) {}

      const sdk = await loadSupabase();
      const client = sdk.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storage: window.localStorage,
          storageKey: STORAGE_KEY
        }
      });

      // getUser verifies the access token with Supabase; a local session object alone is not trusted.
      const result = await client.auth.getUser();
      if (result.error) {
        const status = Number(result.error.status || 0);
        if (status === 401 || status === 403 || /invalid.*token|jwt.*expired|session.*missing/i.test(String(result.error.message || ''))) {
          window.location.replace(AUTH_PATH + '?next=' + encodeURIComponent(safeNext()));
          return;
        }
        showUnavailable();
        return;
      }
      if (!result.data || !result.data.user) {
        window.location.replace(AUTH_PATH + '?next=' + encodeURIComponent(safeNext()));
      }
    } catch (_) {
      showUnavailable();
    }
  })();
})();
