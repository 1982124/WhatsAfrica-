export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    const auth=req.headers.authorization||"";
    if(!auth.startsWith("Bearer ")) return res.status(401).json({error:"Authentication required"});
    const token=auth.slice(7);
    const sbUrl=process.env.SUPABASE_URL||"https://dzifpwqrqnvssfhwjccj.supabase.co";
    const sbKey=process.env.SUPABASE_PUBLISHABLE_KEY||"sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV";
    const u=await fetch(sbUrl+"/auth/v1/user",{headers:{apikey:sbKey,Authorization:"Bearer "+token}});
    if(!u.ok) return res.status(401).json({error:"Invalid session"});
    const body=await u.json();
    const text=String(req.body?.text||"").trim();
    if(text.length<100) return res.status(400).json({error:"PDF text is too short"});
    if(text.length>90000) return res.status(400).json({error:"PDF too long for automatic analysis"});
    const key=process.env.OPENROUTER_API_KEY;
    if(!key) return res.status(503).json({error:"AI service is not configured"});
    const system=`Tu es le moteur éditorial et commercial SEO de WASSAFRICA. À partir du texte d'un ebook fourni par son auteur, prépare une fiche de vente honnête, attractive et optimisée pour la recherche. N'invente jamais un fait, un auteur, un ISBN, un nombre de pages ou une promesse absente du document. Si une donnée est absente, laisse-la vide. Le contenu doit être en français sauf si le livre est clairement dans une autre langue. Le SEO doit viser des recherches naturelles et pertinentes, sans bourrage de mots-clés. Retourne uniquement le JSON demandé.`;
    const schema={type:"object",properties:{
      title:{type:"string"},description:{type:"string"},category:{type:"string"},author_name:{type:"string"},
      language:{type:"string"},page_count:{type:"integer"},edition:{type:"string"},content_kind:{type:"string"},
      target_audience:{type:"string"},sales_angle:{type:"string"},seo_title:{type:"string"},seo_description:{type:"string"},
      seo_keywords:{type:"string"},suggested_price_xof:{type:"number"},pricing_rationale:{type:"string"},
      excerpt:{type:"string"}
    },required:["title","description","category","author_name","language","page_count","edition","content_kind","target_audience","sales_angle","seo_title","seo_description","seo_keywords","suggested_price_xof","pricing_rationale","excerpt"],additionalProperties:false};
    const prompt=`Analyse cet ebook et crée sa fiche commerciale. Le prix suggéré est indicatif : il doit rester prudent et cohérent avec le contenu, le format numérique et le marché francophone africain/diaspora. Texte du PDF:\\n\\n${text}`;
    const rr=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json","HTTP-Referer":"https://wassafrica.vercel.app","X-Title":"WASSAFRICA Ebook Studio"},body:JSON.stringify({model:"openai/gpt-5-mini",messages:[{role:"system",content:system},{role:"user",content:prompt}],temperature:0.2,response_format:{type:"json_schema",json_schema:{name:"ebook_sales_metadata",strict:true,schema}}})});
    const raw=await rr.text();
    if(!rr.ok) return res.status(502).json({error:"AI provider error",detail:raw.slice(0,500)});
    const data=JSON.parse(raw);const content=data.choices?.[0]?.message?.content;
    if(!content) return res.status(502).json({error:"AI returned no result"});
    let out;try{out=JSON.parse(content)}catch{const a=content.indexOf("{"),b=content.lastIndexOf("}");out=JSON.parse(content.slice(a,b+1))}
    return res.status(200).json(out);
  }catch(e){return res.status(500).json({error:e.message||"AI analysis failed"})}
}