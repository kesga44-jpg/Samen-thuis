const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"
};

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const b=await req.json();

    if(b.action==="ned-energy"){
      const key=Deno.env.get("NED_API_KEY");
      if(!key)return j({error:"NED_API_KEY ontbreekt in Supabase secrets"},400);
      const a=new Date(),z=new Date(Date.now()+86400000),d=(x:Date)=>x.toISOString().slice(0,10);
      async function n(type:number,activity:number){
        const u=new URL("https://api.ned.nl/v1/utilizations");
        Object.entries({point:"0",type:String(type),granularity:"5",granularitytimezone:"1",classification:"2",activity:String(activity),"validfrom[after]":d(a),"validfrom[strictly_before]":d(z)})
          .forEach(([k,v])=>u.searchParams.set(k,v));
        const r=await fetch(u,{headers:{"X-AUTH-TOKEN":key,accept:"application/ld+json"}});
        if(!r.ok)throw new Error(`NED ${r.status}`);
        const x=await r.json(),q=x["hydra:member"]||x.member||[];
        return q[q.length-1]||q[0]||null;
      }
      const [solar,wind,load]=await Promise.all([n(2,1),n(1,1),n(59,2)]);
      return j({summary:{solar:f(solar),wind:f(wind),load:f(load),updated:new Date().toLocaleString("nl-NL")}});
    }

    if(b.action==="tankerkoenig"){
      const key=Deno.env.get("TANKERKOENIG_API_KEY");
      if(!key)return j({error:"TANKERKOENIG_API_KEY ontbreekt in Supabase secrets"},400);
      const lat=Number(b.lat),lng=Number(b.lng),rad=Math.min(25,Math.max(1,Number(b.radius||25)));
      const fuel=["e5","e10","diesel"].includes(String(b.fuel))?String(b.fuel):"e10";
      if(!Number.isFinite(lat)||!Number.isFinite(lng))return j({error:"Ongeldige Duitse zoeklocatie"},400);
      const u=new URL("https://creativecommons.tankerkoenig.de/json/list.php");
      Object.entries({lat:String(lat),lng:String(lng),rad:String(rad),sort:"price",type:fuel,apikey:key})
        .forEach(([k,v])=>u.searchParams.set(k,v));
      const r=await fetch(u);
      const x=await r.json().catch(()=>({}));
      if(!r.ok||x.ok===false)throw new Error(x.message||`Tankerkönig ${r.status}`);
      return j({place:b.place||"",fuel,radius:rad,stations:(x.stations||[]).slice(0,12),license:x.license||"CC BY 4.0",updated:new Date().toISOString()});
    }

    return j({error:"Onbekende actie"},400);
  }catch(e){
    return j({error:e?.message||String(e)},500);
  }
});

function f(x:any){if(!x)return null;const k=Number(x.capacity);return Number.isFinite(k)?`${Math.round(k/1000).toLocaleString("nl-NL")} MW`:null}
function j(v:any,status=200){return new Response(JSON.stringify(v),{status,headers:{...cors,"Content-Type":"application/json"}})}
