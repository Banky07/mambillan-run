// POST: record a game event. GET: return the active sponsor ad (if any). Needs Upstash Redis connected in Vercel.
const U=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,T=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
const pipe=async c=>(await(await fetch(U+'/pipeline',{method:'POST',headers:{Authorization:'Bearer '+T},body:JSON.stringify(c)})).json()).map(x=>x.result);
const OK=['visit','start','stage','end','share','ping','ad_view','ad_click'],TTL=7776000;
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!U||!T)return res.status(503).json({});
 if(req.method==='GET'){const[a]=await pipe([['GET','cfg:ads']]);let ad=null;try{ad=JSON.parse(a)}catch(e){}return res.status(200).json({ad:ad&&ad.on?ad:null})}
 let b=req.body;if(typeof b==='string')try{b=JSON.parse(b)}catch(e){b={}}b=b||{};
 const pid=String(b.pid||'').replace(/[^\w-]/g,'').slice(0,40),ev=String(b.ev||'');
 if(pid.length<8||!OK.includes(ev))return res.status(400).json({});
 const d=new Date().toISOString().slice(0,10),now=Date.now(),c=[['ZADD','online',now,pid],['ZREMRANGEBYSCORE','online',0,now-120000]];
 if(ev!=='ping'){
  const[today,ever]=await pipe([['SADD','dau:'+d,pid],['SADD','users',pid]]);
  if(today===1){c.push(['HINCRBY','ev:'+d,ever===1?'new':'returning',1],['EXPIRE','dau:'+d,TTL])}
  c.push(['HINCRBY','ev:'+d,ev,1]);
  if(ev==='end')c.push(['HINCRBY','ev:'+d,'dist',Math.min(Math.floor(+b.dist)||0,20000)]);
  if(ev==='stage')c.push(['HINCRBY','stg:'+d,String(b.stage||'').slice(0,30),1]);
  if(ev==='visit'){
   c.push(['HINCRBY','geo:'+d,String(req.headers['x-vercel-ip-country']||'??').slice(0,3),1],
    ['HINCRBY','ref:'+d,String(b.ref||'direct').slice(0,40),1],
    ['HINCRBY','dev:'+d,/Mobi|Android/i.test(req.headers['user-agent']||'')?'mobile':'desktop',1]);
  }
  ['ev','stg','geo','ref','dev'].forEach(k=>c.push(['EXPIRE',k+':'+d,TTL]));
 }
 await pipe(c);res.status(200).json({ok:1});
};
