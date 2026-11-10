// Vercel serverless function: weekly leaderboard stored in Upstash Redis (add it from Vercel Marketplace > Storage)
const U=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,T=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
const rc=async c=>(await(await fetch(U,{method:'POST',headers:{Authorization:'Bearer '+T},body:JSON.stringify(c)})).json()).result;
module.exports=async(req,res)=>{
 if(!U||!T)return res.status(503).json({error:'store not configured'});
 const k='mrun:w'+Math.floor((Date.now()/864e5+3)/7); // new board every Monday (UTC)
 if(req.method==='POST'){
  let b=req.body;if(typeof b==='string')try{b=JSON.parse(b)}catch(e){b={}}
  b=b||{};
  const name=String(b.name||'').replace(/[^\w \-]/g,'').trim().slice(0,14),s=Math.floor(+b.score),secs=+b.secs;
  if(!name||!(s>0)||!(secs>=5)||s>secs*40+100)return res.status(400).json({error:'rejected'});
  await rc(['ZADD',k,'GT',s,name]);await rc(['EXPIRE',k,1209600]);
 }
 const r=(await rc(['ZREVRANGE',k,0,9,'WITHSCORES']))||[],top=[];
 for(let i=0;i<r.length;i+=2)top.push({name:r[i],score:+r[i+1]});
 res.setHeader('Cache-Control','no-store');res.status(200).json({top});
};
