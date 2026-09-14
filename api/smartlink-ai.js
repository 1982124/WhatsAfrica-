const MAX_BYTES = 180000;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  return res.end(JSON.stringify(body));
}

function cleanText(value, max = 5000) {
  return String(value || '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isBlockedHost(hostname) {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0' || h === '::1') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  const m = h.match(/^172\.(\d+)\./); if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (h.endsWith('.internal') || h.endsWith('.local') || h.endsWith('.home')) return true;
  return false;
}

function extractMeta(html) {
  const pick = (re) => {
    const m = html.match(re); return m ? cleanText(m[1], 1600) : '';
  };
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = pick(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([\s\S]*?)["']/i) || pick(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i);
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([\s\S]*?)["']/i) || pick(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:title["']/i);
  const body = cleanText(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '), 9000);
  return { title: ogTitle || title, description, body };
}

function extractJson(text) {
  const raw = String(text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(raw); } catch (_) {}
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw new Error('Réponse IA invalide.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Méthode non autorisée.' });
  if (!process.env.OPENAI_API_KEY) return json(res, 503, { ok: false, error: 'Le moteur IA Smart Link n’est pas encore configuré côté serveur.' });

  try {
    const url = String(req.body?.url || '').trim();
    let parsed;
    try { parsed = new URL(url); } catch (_) { return json(res, 400, { ok: false, error: 'Lien invalide.' }); }
    if (!/^https?:$/.test(parsed.protocol) || isBlockedHost(parsed.hostname)) return json(res, 400, { ok: false, error: 'Ce type de lien n’est pas accepté.' });

    const upstream = await fetch(parsed.href, { redirect: 'follow', headers: { 'User-Agent': 'WASSAFRICA-SmartLink/1.0' } });
    if (!upstream.ok) return json(res, 422, { ok: false, error: `La page source répond avec HTTP ${upstream.status}.` });
    const type = upstream.headers.get('content-type') || '';
    if (!type.includes('text/html')) return json(res, 422, { ok: false, error: 'Le lien doit pointer vers une page web lisible.' });
    const reader = upstream.body?.getReader();
    if (!reader) return json(res, 422, { ok: false, error: 'Impossible de lire la page source.' });
    const chunks = []; let total = 0;
    while (total < MAX_BYTES) {
      const part = await reader.read(); if (part.done) break;
      total += part.value.byteLength; chunks.push(part.value);
      if (total >= MAX_BYTES) break;
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
    const html = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const meta = extractMeta(html);

    const prompt = `Tu es l’architecte éditorial de WASSAFRICA. À partir d’une page publique, construis un brouillon de Smart Link mobile-first, africain, naturel et orienté confiance/prise de contact.\n\nRÈGLES: conserve uniquement les faits réellement présents dans la source; n’invente jamais prix, stock, certifications, résultats, avis, adresse ou promesse. Tu peux reformuler, raccourcir, structurer et améliorer le ton. Évite le jargon marketing importé. Le texte doit pouvoir convenir au Continent africain et à la diaspora.\n\nRetourne UNIQUEMENT un JSON valide avec: name, activity, bio, cta, links (tableau d’objets label/url), sections (tableau de chaînes), confidence.\n\nURL: ${parsed.href}\nTITRE: ${meta.title}\nDESCRIPTION: ${meta.description}\nCONTENU: ${meta.body}`;

    const ai = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.WASSAFRICA_SMARTLINK_AI_MODEL || 'gpt-5.6-luna',
        input: prompt,
        max_output_tokens: 1200
      })
    });
    const aiData = await ai.json();
    if (!ai.ok) return json(res, 502, { ok: false, error: 'Le moteur IA a refusé ou interrompu la génération.' });
    const text = aiData.output_text || aiData.output?.flatMap(x => x.content || []).map(x => x.text || '').join('') || '';
    const draft = extractJson(text);
    return json(res, 200, { ok: true, source: { title: meta.title, description: meta.description }, draft });
  } catch (error) {
    return json(res, 500, { ok: false, error: cleanText(error?.message || 'Erreur interne.', 300) });
  }
}
