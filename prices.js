import {money,norm,percentile,uniqueNumbers,humanAge} from './utils.js';

export function priceFunctionUrl(data){
  const base=String(data.settings.supabaseUrl||'').replace(/\/$/,'');
  return base ? `${base}/functions/v1/grocery-prices` : '';
}

export function learnedThresholds(track){
  const history=track?.history||[];
  const latest=track?.latest||{};
  const relevant=latest.baseProductId ? history.filter(x=>x.baseProductId===latest.baseProductId) : latest.name ? history.filter(x=>norm(x.name)===norm(latest.name)) : history;
  const values=uniqueNumbers(relevant.map(x=>Number(x.price)).filter(Number.isFinite));
  if(values.length<4) return {floor:null,good:null,count:values.length};
  return {floor:percentile(values,.15),good:percentile(values,.35),count:values.length};
}

export function priceStatus(track){
  const latest=track?.latest;
  if(!latest||!Number.isFinite(Number(latest.price))) return {code:'none',label:'Geen actuele aanbieding',icon:'○'};
  const price=Number(latest.price);
  const learned=learnedThresholds(track);
  const hasManualFloor=track.manualFloor!==null&&track.manualFloor!==''&&Number.isFinite(Number(track.manualFloor));
  const hasManualGood=track.manualGood!==null&&track.manualGood!==''&&Number.isFinite(Number(track.manualGood));
  const floor=hasManualFloor?Number(track.manualFloor):learned.floor;
  const good=hasManualGood?Number(track.manualGood):learned.good;
  if(Number.isFinite(floor) && price<=floor+0.001) return {code:'floor',label:'Bodemprijs',icon:'🔥',floor,good};
  if(Number.isFinite(good) && price<=good+0.001) return {code:'good',label:'Goede prijs',icon:'🟢',floor,good};
  if(Number(latest.savingsPercentage)>=25) return {code:'good',label:'Sterke aanbieding',icon:'🟢',floor,good};
  return {code:'deal',label:'Aanbieding',icon:'🟡',floor,good};
}

export function priceSummary(track,{compact=false}={}){
  if(!track) return '<span class="price-inline muted">Prijs niet gevolgd</span>';
  if(track.error && !track.latest) return `<span class="price-inline price-error">Prijscheck mislukt</span>`;
  if(!track.latest) return `<span class="price-inline muted">Nog geen actuele aanbieding gevonden</span>`;
  const s=priceStatus(track), p=track.latest;
  const until=p.validUntil?` · t/m ${new Date(p.validUntil).toLocaleDateString('nl-NL',{day:'numeric',month:'short'})}`:'';
  const was=p.originalPrice!==null&&p.originalPrice!==''&&Number.isFinite(Number(p.originalPrice))?` · was ${money(p.originalPrice)}`:'';
  const age=p.checkedAt?` · ${humanAge(p.checkedAt)}`:'';
  if(compact) return `<span class="price-inline price-${s.code}">${s.icon} ${money(p.price)} · ${p.retailer||'winkel'}</span>`;
  return `<div class="price-box price-${s.code}">
    <div class="price-top"><strong>${s.icon} ${s.label}</strong><b>${money(p.price)}</b></div>
    <small>${p.retailer||'Onbekende winkel'}${was}${until}${age}</small>
    <small class="price-match">Match: ${p.name||track.query}</small>
  </div>`;
}

function stale(track,hours){
  if(!track.latest?.checkedAt) return true;
  return Date.now()-new Date(track.latest.checkedAt).getTime() >= Math.max(1,Number(hours||12))*3600000;
}

function addObservation(track,result){
  const date=(result.validFrom||new Date().toISOString()).slice(0,10);
  const key=`${date}|${Number(result.price).toFixed(2)}|${result.retailer||''}|${result.name||''}`;
  const exists=(track.history||[]).some(x=>`${x.date}|${Number(x.price).toFixed(2)}|${x.retailer||''}|${x.name||''}`===key);
  if(!exists){
    track.history ||= [];
    track.history.push({date,price:Number(result.price),retailer:result.retailer||'',name:result.name||'',productId:result.productId||'',baseProductId:result.baseProductId||''});
    track.history=track.history.slice(-120);
  }
}

export async function refreshPriceTracks(store,{force=false,onProgress=()=>{}}={}){
  const data=store.data;
  if(!data.settings.autoPriceRefresh && !force) return {checked:0,found:0};
  const tracks=data.priceTracks.filter(t=>t.query && (force||stale(t,data.settings.priceRefreshHours)));
  if(!tracks.length) return {checked:0,found:0};
  const url=priceFunctionUrl(data);
  if(!url) throw new Error('Geen Supabase URL ingesteld');
  const headers={'Content-Type':'application/json'};
  if(data.settings.supabaseAnonKey){ headers.apikey=data.settings.supabaseAnonKey; headers.Authorization=`Bearer ${data.settings.supabaseAnonKey}`; }
  let checked=0,found=0;
  const chunks=[]; for(let i=0;i<tracks.length;i+=12) chunks.push(tracks.slice(i,i+12));
  for(const chunk of chunks){
    onProgress({checked,total:tracks.length});
    const response=await fetch(url,{method:'POST',headers,body:JSON.stringify({queries:chunk.map(t=>({id:t.id,query:t.query,preferredRetailer:t.preferredRetailer||''}))})});
    if(!response.ok) throw new Error(`Prijsservice ${response.status}`);
    const payload=await response.json();
    for(const row of payload.results||[]){
      const track=data.priceTracks.find(t=>t.id===row.id); if(!track) continue;
      checked++;
      if(row.result && Number.isFinite(Number(row.result.price))){
        track.latest={...row.result,price:Number(row.result.price),checkedAt:new Date().toISOString()};
        track.error=''; addObservation(track,track.latest); found++;
      } else {
        track.latest=null; track.error=row.error||'';
      }
    }
  }
  store.save();
  onProgress({checked,total:tracks.length});
  return {checked,found};
}

export function stockToGroceries(store){
  const data=store.data;
  if(!data.settings.autoStockToGroceries) return 0;
  let changed=0;
  for(const stock of data.stock){
    const current=Number(stock.amount||0), min=Number(stock.min||0), desired=Math.max(Number(stock.desired||min),min);
    const should=current<=min;
    const existing=data.groceries.find(g=>g.stockId===stock.id && !g.done);
    if(should){
      const needed=Math.max(1,Math.ceil(desired-current));
      if(existing){
        const before=JSON.stringify([existing.title,existing.amount,existing.unit,existing.category,existing.priceTrackId]);
        existing.amount=needed; existing.unit=stock.unit||existing.unit||''; existing.title=stock.title;
        existing.category=stock.category||existing.category||'Overig'; existing.priceTrackId=stock.priceTrackId||existing.priceTrackId||'';
        if(JSON.stringify([existing.title,existing.amount,existing.unit,existing.category,existing.priceTrackId])!==before) changed++;
      } else {
        data.groceries.push({id:`g_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,title:stock.title,amount:needed,unit:stock.unit||'',category:stock.category||'Overig',store:'',done:false,note:'Automatisch vanuit Voorraad',source:'stock',stockId:stock.id,priceTrackId:stock.priceTrackId||'',purchasedApplied:false});
        changed++;
      }
    } else if(existing && existing.source==='stock') {
      data.groceries=data.groceries.filter(g=>g.id!==existing.id);
      changed++;
    }
  }
  if(changed) store.save();
  return changed;
}

export function linkPriceTrackToItem(store,collection,item,{query,manualFloor,manualGood,preferredRetailer}){
  if(!query){ item.priceTrackId=''; store.cleanupTracks(); return; }
  let track=item.priceTrackId?store.getTrack(item.priceTrackId):null;
  if(!track || norm(track.query)!==norm(query)) track=store.ensureTrack(item.title,query);
  track.label=item.title;
  track.query=query.trim();
  track.manualFloor=manualFloor===''||manualFloor==null?null:Number(manualFloor);
  track.manualGood=manualGood===''||manualGood==null?null:Number(manualGood);
  track.preferredRetailer=preferredRetailer||'';
  item.priceTrackId=track.id;
}
