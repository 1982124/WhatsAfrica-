const COUNTRY_CURRENCY = {
  ML:'XOF',SN:'XOF',CI:'XOF',BF:'XOF',BJ:'XOF',TG:'XOF',NE:'XOF',GW:'XOF',
  CM:'XAF',GA:'XAF',CG:'XAF',TD:'XAF',CF:'XAF',GQ:'XAF',
  GH:'GHS',NG:'NGN',KE:'KES',UG:'UGX',TZ:'TZS',ZA:'ZAR',RW:'RWF',
  ET:'ETB',EG:'EGP',MA:'MAD',DZ:'DZD',TN:'TND',ZM:'ZMW',MW:'MWK',
  BW:'BWP',NA:'NAD',LS:'LSL',SZ:'SZL',MZ:'MZN',AO:'AOA',LR:'LRD',
  SL:'SLE',GM:'GMD',CV:'CVE',MR:'MRU',MU:'MUR',CD:'CDF',BI:'BIF',
  SO:'SOS',SD:'SDG',US:'USD',CA:'CAD',GB:'GBP',IE:'EUR',FR:'EUR',
  DE:'EUR',ES:'EUR',IT:'EUR',PT:'EUR',NL:'EUR',BE:'EUR',AT:'EUR',
  FI:'EUR',GR:'EUR',LU:'EUR',CY:'EUR',MT:'EUR',SK:'EUR',SI:'EUR',
  EE:'EUR',LV:'EUR',LT:'EUR',HR:'EUR',JP:'JPY',CN:'CNY',IN:'INR',
  AU:'AUD',NZ:'NZD',CH:'CHF',AE:'AED',SA:'SAR',QA:'QAR',KW:'KWD',
  TR:'TRY',BR:'BRL',MX:'MXN',SG:'SGD',HK:'HKD',KR:'KRW',PK:'PKR',
  ID:'IDR',MY:'MYR',TH:'THB',PH:'PHP',AR:'ARS',CL:'CLP',CO:'COP'
};
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
  const action = String(req.query?.action || 'detect').toLowerCase();
  if (action === 'detect') {
    const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
    const lang = String(req.headers['accept-language'] || '');
    const localeCountry = (lang.match(/(?:^|[,;\s])[^,;\s-]+-([A-Za-z]{2})(?:[,;\s]|$)/) || [])[1];
    const resolvedCountry = /^[A-Z]{2}$/.test(country) ? country : String(localeCountry || 'ML').toUpperCase();
    return res.status(200).json({
      ok: true,
      country: resolvedCountry,
      currency: COUNTRY_CURRENCY[resolvedCountry] || 'XOF',
      source: country ? 'edge-country' : (localeCountry ? 'browser-locale' : 'default')
    });
  }
  if (action === 'rates') {
    try {
      const upstream = await fetch('https://open.er-api.com/v6/latest/USD', { headers: { Accept: 'application/json' } });
      if (!upstream.ok) throw new Error('fx_upstream_' + upstream.status);
      const data = await upstream.json();
      if (data.result !== 'success' || !data.rates || !Number.isFinite(Number(data.rates.USD))) {
        throw new Error('fx_rates_unavailable');
      }
      res.setHeader('X-WASSAFRICA-FX-Updated', String(data.time_last_update_utc || 'unknown'));
      return res.status(200).json({
        ok: true, base: 'USD', rates: data.rates,
        updated_at: data.time_last_update_utc || null,
        provider: 'ExchangeRate-API Open Access'
      });
    } catch (error) {
      return res.status(503).json({ ok: false, error: 'currency_rates_unavailable' });
    }
  }
  return res.status(400).json({ ok: false, error: 'unsupported_currency_action' });
}
