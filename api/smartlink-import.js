export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const urls=Array.isArray(req.body?.urls)?req.body.urls.filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean).slice(0,20):[];
    if(!urls.length)return res.status(400).json({error:'NO_URLS'});
    if(urls.some(u=>!/^https?:\/\//i.test(u)))return res.status(400).json({error:'INVALID_URL'});
    const key=process.env.OPENAI_API_KEY;
    if(!key)return res.status(503).json({error:'AI_NOT_CONFIGURED',message:'L’IA Smart Link nécessite OPENAI_API_KEY dans Vercel.'});
    const prompt=`Tu es l'assistant commercial de WASSAFRICA. Analyse les pages correspondant aux URLs fournies avec la recherche web. Pour chaque URL, crée UNE offre exploitable dans un Smart Link. Ne fabrique jamais un prix, une caractéristique ou une disponibilité absente de la source. Si une donnée manque, mets null ou une chaîne vide. Retourne uniquement un objet JSON avec une clé "offers", tableau de 1 à 20 objets. Champs: title, description, price(number|null), currency(string), stock(number|null), category, product_type(physical|digital|service), source_url, image_url(string|null). L'image doit être une URL publique d'image réellement présente sur la page si elle est identifiable. URLs: ${urls.join('\n')}`;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,text:{format:{type:'json_schema',name:'smartlink_offers',strict:true,schema:{type:'object',properties:{offers:{type:'array',items:{type:'object',properties:{title:{type:'string'},description:{type:'string'},price:{type:['number','null']},currency:{type:'string'},stock:{type:['number','null']},category:{type:'string'},product_type:{type:'string',enum:['physical','digital','service']},source_url:{type:'string'},image_urls:{type:'array',items:{type:'string'},maxItems:5}},required:['title','description','price','currency','stock','category','product_type','source_url','image_urls'],additionalProperties:false}}},required:['offers'],additionalProperties:false}}}})});
    const j=await r.json();
    if(!r.ok)return res.status(502).json({error:'AI_REQUEST_FAILED',detail:j?.error?.message||'Erreur IA'});
    const out=j.output_text||j.output?.map(x=>x.content?.map(y=>y.text||'').join('')).join('');
    let data;try{data=JSON.parse(out)}catch{throw new Error('AI_INVALID_JSON')}
    return res.status(200).json(data);
  }catch(e){return res.status(500).json({error:'IMPORT_FAILED',message:e.message||'Erreur import IA'})}
}