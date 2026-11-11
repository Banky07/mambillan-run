// GET: dashboard stats. POST: save the sponsor ad. Protected by the ADMIN_KEY environment variable.
const crypto=require('crypto');
const U=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,T=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
const pipe=async c=>(await(await fetch(U+'/pipeline',{method:'POST',headers:{Authorization:'Bearer '+T},body:JSON.stringify(c)})).json()).map(x=>x.result);
const same=(a,b)=>{a=Buffer.from(String(a));b=Buffer.from(String(b));return a.length===b.length&&crypto.timingSafeEqual(a,b)};
const flat=a=>{const o={};for(let i=0;i<(a||[]).length;i+=2)o[a[i]]=+a[i+1];return o};
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const K=process.env.ADMIN_KEY,got=(req.headers.authorization||'').replace(/^Bearer /,'');
 if(!K||!U||!T)return res.status(503).json({error:'Set ADMIN_KEY and connect Upstash Redis in Vercel, then redeploy.'});
 if(!same(got,K))return res.status(401).json({error:'Wrong key.'});
 if(req.method==='POST'){
  let b=req.body;if(typeof b==='string')try{b=JSON.parse(b)}catch(e){b={}}b=b||{};
  const https=s=>/^https:\/\/[^\s"'<>]+$/.test(String(s||''))?String(s):'';
  const ad={on:!!b.on,text:String(b.text||'').slice(0,120),img:https(b.img),link:https(b.link)};
  if(ad.on&&(!ad.text||!ad.link))return res.status(400).json({error:'An ad needs text and an https link.'});
  await pipe([['SET','cfg:ads',JSON.stringify(ad)]]);return res.status(200).json({ok:1});
 }
 const n=Math.min(Math.max(+req.query.days||14,1),60),days=[];
 for(let i=n-1;i>=0;i--)days.push(new Date(Date.now()-i*864e5).toISOString().slice(0,10));
 const c=[['ZCOUNT','online',Date.now()-90000,'+inf'],['SCARD','users'],['GET','cfg:ads']];
 days.forEach(d=>c.push(['HGETALL','ev:'+d],['SCARD','dau:'+d],['HGETALL','stg:'+d],['HGETALL','geo:'+d],['HGETALL','ref:'+d],['HGETALL','dev:'+d]));
 const r=await pipe(c);let ad=null;try{ad=JSON.parse(r[2])}catch(e){}
 res.status(200).json({online:r[0],users:r[1],ad,days:days.map((d,i)=>{const o=3+i*6;return{d,ev:flat(r[o]),dau:r[o+1],stg:flat(r[o+2]),geo:flat(r[o+3]),ref:flat(r[o+4]),dev:flat(r[o+5])}})});
};
