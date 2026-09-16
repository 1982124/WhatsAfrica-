const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dzifpwqrqnvssfhwjccj.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const MODELS = (process.env.OPENROUTER_MODELS || 'qwen/qwen3.6-flash,qwen/qwen3.5-9b').split(',').map(x => x.trim()).filter(Boolean).slice(0, 4);
const MAX_BODY = 12000;
const FETCH_TIMEOUT_MS = 18000;

const clean = (v, max = 2000) => typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, max).trim() : '';
const json = (v, fallback = {}) => v && typeof v === 'object' ? v : fallback;

function requestId(req) {
  return clean(req.headers['x-request-id'], 120) || crypto.randomUUID();
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...options, signal: controller.signal });
    const text = await r.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    return { ok: r.ok, status: r.status, data };
  } finally { clearTimeout(timer); }
}

function sbHeaders(token) {
  const key = SERVICE_KEY || '';
  return {
    apikey: key,
    Authorization: `Bearer ${token || key}`,
    'Content-Type': 'application/json'
  };
}

async function authenticate(req) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return { ok: false, status: 401, code: 'missing_bearer' };
  if (!SERVICE_KEY) return { ok: false, status: 503, code: 'server_auth_not_configured' };
  const token = auth.slice(7).trim();
  if (!token) return { ok: false, status: 401, code: 'missing_bearer' };
  const result = await fetchJson(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` } });
  if (!result.ok || !result.data?.id) return { ok: false, status: 401, code: 'invalid_session' };
  const admin = await fetchJson(`${SUPABASE_URL}/rest/v1/rpc/is_platform_admin`, { method: 'POST', headers: sbHeaders(token), body: '{}' });
  return { ok: true, token, user: result.data, isAdmin: admin.ok && admin.data === true };
}

async function auditInsert(event) {
  if (!SERVICE_KEY) return false;
  const r = await fetchJson(`${SUPABASE_URL}/rest/v1/ai_core_events`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(event)
  });
  if (!r.ok) console.error('[ai-core] audit insert failed', r.status, r.data);
  return r.ok;
}

async function auditUpdate(id, patch) {
  if (!SERVICE_KEY || !id) return false;
  const r = await fetchJson(`${SUPABASE_URL}/rest/v1/ai_core_events?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(patch)
  });
  if (!r.ok) console.error('[ai-core] audit update failed', r.status, r.data);
  return r.ok;
}

async function toolDemandReport(auth, input) {
  if (!auth.isAdmin) return { ok: false, status: 403, code: 'admin_required' };
  const hours = Math.max(1, Math.min(168, Number(input.hours || 24)));
  const countries = Array.isArray(input.countries) ? input.countries.slice(0, 50).map(x => clean(x, 80)).filter(Boolean) : [];
  const zones = Array.isArray(input.zones) ? input.zones.slice(0, 50).map(x => clean(x, 80)).filter(Boolean) : [];
  const products = Array.isArray(input.products) ? input.products.slice(0, 50).map(x => clean(x, 120)).filter(Boolean) : [];
  const r = await fetchJson(`${SUPABASE_URL}/rest/v1/rpc/admin_generate_demand_report`, {
    method: 'POST', headers: sbHeaders(auth.token),
    body: JSON.stringify({ p_hours: hours, p_countries: countries, p_zones: zones, p_products: products })
  });
  if (!r.ok) return { ok: false, status: r.status, code: 'demand_report_failed', detail: r.data };
  return { ok: true, tool: 'demand_report', data: r.data };
}

const TOOLS = {
  demand_report: {
    description: 'Génère un rapport de demande autorisé à partir des observations globales.',
    roles: ['admin'],
    run: toolDemandReport,
    mutating: true,
    requiresConfirmation: true
  }
};

function classify(message) {
  const q = clean(message, 2000).toLowerCase();
  if (/demande|besoin|tendance|opportunit|march[eé]|produit.*recherch|global command/.test(q)) return 'demand_intelligence';
  if (/smart.?link|tarif|abonnement|prix/.test(q)) return 'smartlink_commercial';
  if (/message|conversation|contact|client/.test(q)) return 'messaging_crm';
  return 'general_assistance';
}

function selectTool(intent) {
  if (intent === 'demand_intelligence') return 'demand_report';
  return null;
}

async function reasonPlan(message, intent, toolResult) {
  if (!OPENROUTER_KEY) return {
    summary: `Intention détectée : ${intent}.`,
    next_action: toolResult ? 'Analyser le résultat de l’outil autorisé.' : 'Aucun outil spécialisé sélectionné.',
    confidence: 0.65
  };
  const prompt = `Tu es le moteur de décision de WassAfrica. Tu dois être factuel, ne rien inventer et distinguer données observées, interprétation et action proposée.\nIntention: ${intent}\nDemande: ${message}\nDonnées outil: ${JSON.stringify(toolResult).slice(0, 12000)}\nRetourne uniquement JSON avec summary, findings (array), proposed_action, confidence (0..1).`;
  const r = await fetchJson('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENROUTER_KEY}`, 'HTTP-Referer': 'https://wassafrica.vercel.app', 'X-Title': 'WassAfrica AI Core' },
    body: JSON.stringify({ model: MODELS[0], models: MODELS, messages: [{ role: 'system', content: 'Réponds en JSON strict.' }, { role: 'user', content: prompt }], temperature: 0.1, max_tokens: 900 })
  });
  const content = r.data?.choices?.[0]?.message?.content || '';
  try { return JSON.parse(content.replace(/^```json\s*|\s*```$/g, '')); } catch { return { summary: clean(content, 4000), findings: [], proposed_action: null, confidence: 0.4 }; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
  const rid = requestId(req);
  try {
    const auth = await authenticate(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.code, request_id: rid });
    const body = json(req.body);
    const message = clean(body.message, 2000);
    if (!message) return res.status(400).json({ error: 'message_required', request_id: rid });
    const intent = classify(message);
    const requestedTool = clean(body.tool, 80) || selectTool(intent);
    const tool = requestedTool ? TOOLS[requestedTool] : null;
    if (requestedTool && !tool) return res.status(400).json({ error: 'tool_not_allowed', request_id: rid });
    if (tool && tool.roles.includes('admin') && !auth.isAdmin) return res.status(403).json({ error: 'admin_required', request_id: rid });

    const audit = { request_id: rid, user_id: auth.user.id, intent, status: 'planned', tool_name: requestedTool || null, tool_input: json(body.tool_input), decision: {}, verification: null };
    await auditInsert(audit);

    let toolResult = null;
    if (tool && body.execute === true && tool.requiresConfirmation && !body.confirmation_id) {
      const decision = { confirmation_required: true, reason: 'L’action sélectionnée modifie/génère des données opérationnelles.', tool: requestedTool };
      return res.status(200).json({ ok: true, request_id: rid, intent, decision, next: { confirmation_id: rid, execute: true } });
    }

    if (tool && body.execute === true) {
      toolResult = await tool.run(auth, json(body.tool_input));
      if (!toolResult.ok) {
        await auditUpdate(null, { status: 'failed', error_code: toolResult.code });
        return res.status(toolResult.status || 500).json({ ok: false, request_id: rid, intent, error: toolResult.code });
      }
      const decision = await reasonPlan(message, intent, toolResult.data);
      await auditInsert({ request_id: `${rid}:execution`, user_id: auth.user.id, intent, status: 'executed', tool_name: requestedTool, tool_input: json(body.tool_input), tool_output: toolResult.data, decision, verification: { tool_ok: true } });
      return res.status(200).json({ ok: true, request_id: rid, intent, tool: requestedTool, result: toolResult.data, decision, verification: { status: 'verified', tool_ok: true } });
    }

    const decision = await reasonPlan(message, intent, null);
    await auditInsert({ request_id: `${rid}:plan`, user_id: auth.user.id, intent, status: 'confirmation_required', tool_name: requestedTool || null, tool_input: json(body.tool_input), decision, verification: { planned: true } });
    return res.status(200).json({ ok: true, request_id: rid, intent, decision, tool: requestedTool, action: requestedTool ? { mode: 'confirmation_required', tool: requestedTool } : { mode: 'no_action' } });
  } catch (error) {
    console.error('[ai-core] failed', rid, error?.message || error);
    return res.status(500).json({ ok: false, error: 'ai_core_failed', request_id: rid });
  }
};
