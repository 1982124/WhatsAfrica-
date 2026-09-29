const SB = process.env.SUPABASE_URL || 'https://dzifpwqrqnvssfhwjccj.supabase.co';
const KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';

async function select(table, params) {
  const u = new URL(SB + '/rest/v1/' + table);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }, cache: 'no-store' });
  const body = await r.text();
  if (!r.ok) throw new Error(table + ':' + r.status + ':' + body.slice(0, 300));
  return JSON.parse(body);
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const [smart_links, products, marketplace_services, product_collections] = await Promise.all([
      select('smart_links', { select: 'business_id,slug,title,description', is_public: 'eq.true', order: 'created_at.desc', limit: '1000' }),
      select('products', { select: 'id,title,description,price,currency,image_url,category,product_type,business_id,is_published,created_at', is_published: 'eq.true', order: 'created_at.desc', limit: '1000' }),
      select('marketplace_services', { select: 'id,title,description,category,price,currency,seller_id,status,metadata,created_at', status: 'eq.published', order: 'created_at.desc', limit: '1000' }),
      select('product_collections', { select: 'id,name,description,cover_url,is_published,price,currency,created_at', is_published: 'eq.true', order: 'created_at.desc', limit: '1000' })
    ]);
    const businessIds = [...new Set([...products.map(x => x.business_id), ...smart_links.map(x => x.business_id)].filter(Boolean))];
    const ownerIds = [...new Set(marketplace_services.map(x => x.seller_id).filter(Boolean))];
    const businesses = businessIds.length ? await select('businesses', { select: 'id,owner_id,name,description,city,country,logo_url,cover_image_url,business_type,slug', id: 'in.(' + businessIds.join(',') + ')' }) : [];
    const ownerBusinesses = ownerIds.length ? await select('businesses', { select: 'id,owner_id,name,description,city,country,logo_url,cover_image_url,business_type,slug', owner_id: 'in.(' + ownerIds.join(',') + ')' }) : [];
    res.status(200).json({ ok: true, smart_links, products, marketplace_services, product_collections, businesses, ownerBusinesses });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e && e.message || e) });
  }
}

module.exports = handler;
