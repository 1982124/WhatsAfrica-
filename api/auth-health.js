const SUPABASE_URL = 'https://dzifpwqrqnvssfhwjccj.supabase.co';
const PROD_ORIGIN = 'https://wassafrica.vercel.app';

function timedFetch(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

module.exports = async function handler(req, res) {
  if (req.method === 'POST' && req.query?.mode === 'ebook-ai') {
    try {
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
      const token = auth.slice(7);
      const publishable = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
      const who = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: publishable, Authorization: 'Bearer ' + token } });
      if (!who.ok) return res.status(401).json({ error: 'Invalid session' });
      const text = String(req.body?.text || '').trim();
      if (text.length < 100 || text.length > 90000) return res.status(400).json({ error: 'Invalid PDF text size' });
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) return res.status(503).json({ error: 'AI service is not configured' });
      const schema = { type:'object', properties:{
        title:{type:'string'},description:{type:'string'},category:{type:'string'},author_name:{type:'string'},language:{type:'string'},
        page_count:{type:'integer'},edition:{type:'string'},target_audience:{type:'string'},sales_angle:{type:'string'},
        seo_title:{type:'string'},seo_description:{type:'string'},seo_keywords:{type:'string'},suggested_price_xof:{type:'number'},
        pricing_rationale:{type:'string'},excerpt:{type:'string'}
      }, required:['title','description','category','author_name','language','page_count','edition','target_audience','sales_angle','seo_title','seo_description','seo_keywords','suggested_price_xof','pricing_rationale','excerpt'], additionalProperties:false };
      const prompt = 'Tu es le moteur éditorial et commercial SEO de WASSAFRICA. Analyse le texte de cet ebook et prépare une fiche de vente honnête, attractive et optimisée pour la recherche. N’invente jamais auteur, ISBN, pages, dates ou promesses absentes. Si une donnée manque, laisse-la vide. Réponds uniquement en JSON conforme au schéma. Le prix suggéré est indicatif et prudent pour le marché francophone africain et diaspora.\n\nTEXTE:\n' + text;
      const ai = await fetch('https://openrouter.ai/api/v1/chat/completions', { method:'POST', headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','HTTP-Referer':PROD_ORIGIN,'X-Title':'WASSAFRICA Ebook Studio'}, body:JSON.stringify({model:'openai/gpt-5-mini',messages:[{role:'system',content:'Tu es un éditeur numérique expert SEO et conversion.'},{role:'user',content:prompt}],temperature:0.2,response_format:{type:'json_schema',json_schema:{name:'ebook_sales_metadata',strict:true,schema}}}) });
      const raw=await ai.text();
      if(!ai.ok) return res.status(502).json({error:'AI provider error',detail:raw.slice(0,500)});
      const parsed=JSON.parse(raw), content=parsed.choices?.[0]?.message?.content;
      if(!content) return res.status(502).json({error:'AI returned no result'});
      return res.status(200).json(JSON.parse(content));
    } catch (e) { return res.status(500).json({error:e.message || 'AI analysis failed'}); }
  }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=self, microphone=self, geolocation=none, payment=none');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const checks = {};
  const started = Date.now();
  try {
    const r = await timedFetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { Accept: 'application/json' } });
    checks.supabase = r.ok ? 'healthy' : 'degraded';
  } catch (_) {
    checks.supabase = 'down';
  }

  // Provider login flows are not probed here: doing so would require user credentials,
  // consume OTPs, or expose provider secrets. Keep certification distinct from infrastructure health.
  checks.phone = 'not_certified';
  checks.email = 'not_certified';
  checks.google = 'not_certified';
  checks.profile = 'not_certified';
  checks.session = 'not_certified';

  const degraded = checks.supabase === 'down' || checks.supabase === 'degraded';
  return res.status(200).json({
    ok: !degraded,
    status: degraded ? 'degraded' : 'healthy',
    environment: 'production',
    origin: PROD_ORIGIN,
    checks,
    provider_isolation: true,
    secondary_failure_does_not_block_auth: true,
    secrets_exposed: false,
    elapsed_ms: Date.now() - started,
    certification_rule: 'infrastructure_healthy_does_not_equal_provider_certified',
    generated_at: new Date().toISOString()
  });
};
