window.WhatsAfricaAuthResilience = (() => {
  const PROD_ORIGIN = 'https://whatsafrica.vercel.app';
  const PROVIDER_MESSAGES = {
    google: 'Google rencontre actuellement un problème de connexion. Votre compte WhatsAfrica n’est pas perdu.',
    phone: 'La réception SMS rencontre actuellement un problème. Votre compte WhatsAfrica n’est pas perdu.',
    email: 'La connexion par e-mail rencontre actuellement un problème. Votre compte WhatsAfrica n’est pas perdu.'
  };

  function safeNext(next) {
    try {
      const url = new URL(next || '/inbox', PROD_ORIGIN);
      if (url.origin !== PROD_ORIGIN || !url.pathname.startsWith('/')) return '/inbox';
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (_) { return '/inbox'; }
  }

  function classify(error) {
    const text = String(error?.message || error || '').toLowerCase();
    if (/google|oauth|external code|invalid_client|invalid_grant|redirect_uri/.test(text)) return 'google';
    if (/phone|sms|otp|hook|twilio|esms/.test(text)) return 'phone';
    if (/email|magic|otp/.test(text)) return 'email';
    return 'unknown';
  }

  function userMessage(error) {
    const provider = classify(error);
    return {
      provider,
      message: PROVIDER_MESSAGES[provider] || 'La connexion rencontre momentanément un problème. Votre compte WhatsAfrica n’est pas perdu.',
      alternatives: provider === 'google' ? ['phone', 'email'] : provider === 'phone' ? ['email', 'google'] : ['phone', 'google']
    };
  }

  function redirect(next) {
    window.location.assign(`${PROD_ORIGIN}/auth?next=${encodeURIComponent(safeNext(next))}`);
  }

  return { classify, userMessage, safeNext, redirect };
})();
