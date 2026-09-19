export default function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const raw=process.env.TURN_URLS||'';
  const urls=raw.split(',').map(v=>v.trim()).filter(Boolean);
  if(!urls.length)return res.status(200).json({iceServers:[]});
  const server={urls};
  if(process.env.TURN_USERNAME)server.username=process.env.TURN_USERNAME;
  if(process.env.TURN_CREDENTIAL)server.credential=process.env.TURN_CREDENTIAL;
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({iceServers:[server]});
}
