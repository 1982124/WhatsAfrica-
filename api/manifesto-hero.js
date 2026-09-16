export default async function handler(req, res) {
  const source = 'https://dzifpwqrqnvssfhwjccj.supabase.co/storage/v1/object/public/profile-media/e9e27fe0-83a6-46cf-ac39-676a30d9eac1/smartlink/cover-4f5442a4-540e-486f-ac5c-8914961c8964.png';
  try {
    const response = await fetch(source, { cache: 'no-store' });
    if (!response.ok) {
      return res.status(502).json({ error: 'Manifesto hero source unavailable' });
    }
    const type = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(502).json({ error: 'Manifesto hero proxy failed' });
  }
}
