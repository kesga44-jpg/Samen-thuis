import {money,norm,esc,humanAge} from './js/utils.js';
import './supabase/functions/_shared/price-history-core.js';

const priceHistoryCore=globalThis.SamenThuisPriceHistory;

export function priceFunctionUrl(data){
  const base=String(data.settings.supabaseUrl||'').replace(/\/$/,'');
  return base ? `${base}/functions/v1/grocery-prices` : '';
}

export function learnedThresholds(track){
  return priceHistoryCore.learnedThresholds(track);
}

export function priceStatus(track){
  return priceHistoryCore.priceStatus(track);
}

export function priceSummary(track,{compact=false}={}){
  if(!track) return '<span class="price-inline muted">Prijs niet gevolgd</span>';
  if(track.error && !track.latest) return `<span class="price-inline price-error">Prijscheck mislukt</span>`;
  if(!track.latest) return `<span class="price-inline muted">Nog geen actuele aanbieding gevonden</span>`;
  const s=priceStatus(track), p=track.latest;
  const until=p.validUntil?` · t/m ${new Date(p.validUntil).toLocaleDateString('nl-NL',{day:'numeric',month:'short'})}`:'';
  const was=p.originalPrice!==null&&p.originalPrice!==''&&Number.isFinite(Number(p.originalPrice))?` · was ${money(p.originalPrice)}`:'';
  const age=p.checkedAt?` · ${humanAge(p.checkedAt)}`:'';
  const retailer=esc(p.retailer||'winkel');
  const match=esc(p.name||track.query||'onbekend product');
  const source=esc(p.source||'onbekend');
  const packageInfo=esc(p.packaging||p.quantity||p.size||'Verpakking onbekend');
  const matchNotice=s.code==='unverified'?' · productmatch niet bevestigd':'';
  const refreshNotice=track.error?'<small class="price-error">Verversen mislukt; laatst bekende prijs wordt getoond.</small>':'';
  if(compact) return `<span class="price-inline price-${s.code}" title="${s.label}${matchNotice}">${s.icon} ${s.code==='unverified'?'Match controleren · ':''}${money(p.price)} · ${retailer}</span>`;
  return `<div class="price-box price-${s.code}">
    <div class="price-top"><strong>${s.icon} ${s.label}</strong><b>${money(p.price)}</b></div>
    <small>${retailer}${was}${until}${age}</small>
    <small>Verpakking: ${packageInfo} · Bron: ${source}</small>
    <small class="price-match">${s.code==='unverified'?'Niet gebruikt voor automatische prijsgrenzen. Match: ':'Match: '}${match}</small>
    ${refreshNotice}</div>`;
}

function stale(track,hours){
  if(!track.latest?.checkedAt) return true;
  return Date.now()-new Date(track.latest.checkedAt).getTime() >= Math.max(1,Number(hours||12))*3600000;
}

function addObservation(track,result){
  const observation=priceHistoryCore.createObservation(result);
  if(!observation) return;
  const key=JSON.stringify([observation.date,observation.price,observation.source,observation.retailer,observation.productId,observation.baseProductId,observation.ean,observation.packaging]);
  const exists=(track.history||[]).some(x=>JSON.stringify([x.date,priceHistoryCore.validPrice(x.price),x.source||'',x.retailer||'',x.productId||'',x.baseProductId||'',x.ean||'',x.packaging||x.quantity||x.size||''])===key);
  if(!exists){
    track.history ||= [];
    track.history.push(observation);
    track.history=track.history.slice(-120);
  }
}

export async function refreshPriceTracks(store,{force=false,onProgress=()=>{},fetchImpl=globalThis.fetch}={}){
  const data=store.data;
  if(!data.settings.autoPriceRefresh && !force) return {checked:0,found:0};
  const tracks=data.priceTracks.filter(t=>t.query && (force||stale(t,data.settings.priceRefreshHours)));
  if(!tracks.length) return {checked:0,found:0};
  const url=priceFunctionUrl(data);
  if(!url) throw new Error('Geen Supabase URL ingesteld');
  if(typeof fetchImpl!=='function') throw new Error('Prijsservice is niet beschikbaar in deze browser');
  const headers={'Content-Type':'application/json'};
  if(data.settings.supabaseAnonKey){ headers.apikey=data.settings.supabaseAnonKey; headers.Authorization=`Bearer ${data.settings.supabaseAnonKey}`; }
  let checked=0,found=0;
  const chunks=[]; for(let i=0;i<tracks.length;i+=12) chunks.push(tracks.slice(i,i+12));
  for(const chunk of chunks){
    onProgress({checked,total:tracks.length});
    const response=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify({queries:chunk.map(t=>({id:t.id,query:t.query,preferredRetailer:t.preferredRetailer||''}))})});
    if(!response.ok) throw new Error(response.status===429?'Prijsservice heeft de tijdelijke aanvraaglimiet bereikt. Probeer later opnieuw.':`Prijsservice ${response.status}`);
    const payload=await response.json();
    for(const row of payload.results||[]){
      const track=data.priceTracks.find(t=>t.id===row.id); if(!track) continue;
      checked++;
      const price=priceHistoryCore.validPrice(row.result?.price);
      if(row.result && price!=null){
        track.latest={...row.result,price,checkedAt:new Date().toISOString()};
        track.error=''; addObservation(track,track.latest); found++;
      } else {
        track.error=row.error||'Prijs niet beschikbaar';
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
  track.manualFloor=manualFloor===''||manualFloor==null?null:priceHistoryCore.validPrice(manualFloor);
  track.manualGood=manualGood===''||manualGood==null?null:priceHistoryCore.validPrice(manualGood);
  track.preferredRetailer=preferredRetailer||'';
  item.priceTrackId=track.id;
}
