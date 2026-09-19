(function () {
  'use strict';

  const SB = 'https://dzifpwqrqnvssfhwjccj.supabase.co';
  const KEY = 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
  let clientPromise = null;

  function client() {
    if (!clientPromise) {
      clientPromise = Promise.resolve(
        window.supabase.createClient(SB, KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage
          }
        })
      );
    }
    return clientPromise;
  }

  async function requireAdmin() {
    const db = await client();
    const sessionResult = await db.auth.getSession();
    const session = sessionResult.data && sessionResult.data.session;

    if (!session) {
      location.replace('/cockpit?next=' + encodeURIComponent(location.pathname + location.search));
      throw new Error('ADMIN_AUTH_REQUIRED');
    }

    const adminResult = await db.rpc('is_platform_admin');
    if (adminResult.error || adminResult.data !== true) {
      await db.auth.signOut();
      location.replace('/cockpit');
      throw new Error('ADMIN_REQUIRED');
    }

    const response = await fetch('/api/admin-overview', {
      headers: { Authorization: 'Bearer ' + session.access_token },
      cache: 'no-store'
    });

    if (response.status === 403) {
      const data = await response.json().catch(() => ({}));
      if (data.error === 'email_mfa_required') {
        location.replace('/cockpit?next=' + encodeURIComponent(location.pathname + location.search));
        throw new Error('ADMIN_MFA_REQUIRED');
      }
    }

    if (!response.ok) {
      location.replace('/cockpit?next=' + encodeURIComponent(location.pathname + location.search));
      throw new Error('ADMIN_SESSION_INVALID');
    }

    window.WA_ADMIN_SESSION = { db, session };
    return window.WA_ADMIN_SESSION;
  }

  window.WA_ADMIN_SSO = { requireAdmin };
})();