import {deepClone,id,todayISO,addDays,norm} from './utils.js';

export const STORAGE_KEY='samenThuisBetaV1';
export const SYNC_KEY='samenThuisBetaSyncV1';
export const DEFAULT_SUPABASE_URL='https://vwfuetxgapzfivydzhxc.supabase.co';
export const DEFAULT_SUPABASE_KEY='sb_publishable_Xa1oLeM64F-jog1vVjJbkQ_BE3UV6mR';

export const defaultData=()=>({
  meta:{version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),environment:'beta'},
  settings:{
    people:['Kees','Daphne'],
    autoStockToGroceries:true,
    autoPriceRefresh:true,
    priceRefreshHours:12,
    preferredStores:[],
    supabaseUrl:DEFAULT_SUPABASE_URL,
    supabaseAnonKey:DEFAULT_SUPABASE_KEY,
    householdCode:'',
    lastSyncedAt:'', weatherLat:'', weatherLon:'', vehiclePlate:'', openDataQuery:'energie', dataSourcesCache:{},
    fuelRadarFuel:'e10',
    fuelRadarLocations:[
      {id:'rotterdam',name:'Rotterdam',kind:'nl',note:'Thuis'},
      {id:'nieuwerkerk',name:'Nieuwerkerk aan den IJssel',kind:'nl',note:'Carpool'},
      {id:'utrecht',name:'Utrecht',kind:'nl',note:'Werk Kees'},
      {id:'delft',name:'Delft',kind:'nl',note:'Training'},
      {id:'obdam',name:'Obdam',kind:'nl',note:'Ouders'},
      {id:'oudbeijerland',name:'Oud-Beijerland',kind:'nl',note:'Werk Daphne / omgeving'},
      {id:'fijnaart',name:'Fijnaart',kind:'nl',note:'Schoonouders'},
      {id:'belgie',name:'België nabij Fijnaart',kind:'be',note:'Grensoptie'},
      {id:'duitsland',name:'Emmerich am Rhein / Kleve',kind:'de',note:'Duitsland vanaf regio Rotterdam'}
    ],
    fuelRadarCache:{}
  },
  planning:[], meals:[], groceries:[], chores:[], stock:[], ideas:[], home:[],
  tripFolders:[], tripSections:[], trips:[], priceTracks:[], dailyAnswers:{}, cars:[], fuelEntries:[],
  importHistory:[]
});

function safeArray(v){ return Array.isArray(v)?v:[]; }
function normalizeTrack(track={}){
  return {
    id:track.id||id('pt'), label:track.label||track.query||'Product', query:track.query||track.label||'',
    manualFloor:track.manualFloor!==null&&track.manualFloor!==''&&Number.isFinite(Number(track.manualFloor))?Number(track.manualFloor):null,
    manualGood:track.manualGood!==null&&track.manualGood!==''&&Number.isFinite(Number(track.manualGood))?Number(track.manualGood):null,
    preferredRetailer:track.preferredRetailer||'', latest:track.latest||null,
    history:safeArray(track.history).slice(-120), error:track.error||''
  };
}

export function migrate(raw){
  const base=defaultData();
  if(!raw||typeof raw!=='object') return base;
  const out={...base,...raw};
  out.meta={...base.meta,...raw.meta,version:1,environment:'beta'};
  out.settings={...base.settings,...raw.settings};
  ['planning','meals','groceries','chores','stock','ideas','home','tripFolders','tripSections','trips','priceTracks','importHistory','cars','fuelEntries'].forEach(k=>out[k]=safeArray(raw[k]));
  out.dailyAnswers=raw.dailyAnswers&&typeof raw.dailyAnswers==='object'?raw.dailyAnswers:{};
  out.priceTracks=out.priceTracks.map(normalizeTrack);
  out.stock=out.stock.map(x=>({desired:Number(x.desired??x.min??0),priceTrackId:x.priceTrackId||'',...x}));
  out.groceries=out.groceries.map(x=>({done:false,amount:1,unit:'',source:'manual',priceTrackId:'',...x}));
  out.chores=out.chores.map(x=>({frequency:x.frequency||x.repeat||'Wekelijks',nextDate:x.nextDate||x.due||todayISO(),completedDates:safeArray(x.completedDates),...x}));
  return out;
}

export function migrateProduction(raw){
  const out=defaultData();
  if(!raw||typeof raw!=='object') return out;
  out.planning=safeArray(raw.planning).map(x=>({id:x.id||id('p'),title:x.title||'',date:x.date||'',time:x.time||'',endTime:x.endTime||'',person:x.person||'Samen',calendar:x.calendar||x.calendarId||'Persoonlijk',note:x.note||''}));
  out.meals=safeArray(raw.meals).map(x=>({id:x.id||id('m'),date:x.date||'',type:x.type||'Avondeten',title:x.title||'',persons:x.persons||'',note:x.note||''}));
  out.groceries=safeArray(raw.groceries).map(x=>({id:x.id||id('g'),title:x.title||'',amount:Number(x.amount||1),unit:x.unit||'',category:x.category||'Overig',store:x.store||'',done:Boolean(x.done),note:x.note||'',source:'production-copy',priceTrackId:''}));
  out.chores=safeArray(raw.chores).map(x=>({id:x.id||id('c'),title:x.title||'',category:x.category||'',frequency:x.frequency||x.repeat||'Wekelijks',person:x.person||'Samen',nextDate:x.nextDate||x.due||todayISO(),priority:x.priority||'Normaal',notes:x.notes||'',completedDates:safeArray(x.completedDates)}));
  out.stock=safeArray(raw.stock).map(x=>({id:x.id||id('s'),title:x.title||'',category:x.category||'Overig',amount:Number(x.amount||0),min:Number(x.min||0),desired:Number(x.desired??Math.max(Number(x.min||0),Number(x.amount||0))),unit:x.unit||'stuks',location:x.location||'',bestBefore:x.bestBefore||'',note:x.note||'',priceTrackId:''}));
  out.ideas=safeArray(raw.ideas).map(x=>({id:x.id||id('i'),title:x.title||'',category:x.category||'Thuis',description:x.description||x.note||'',person:x.person||'',priority:x.priority||'',status:x.status||'',date:x.date||''}));
  out.home=safeArray(raw.home).map(x=>({id:x.id||id('h'),title:x.title||'',category:x.category||'Onderhoud',description:x.description||x.note||'',priority:x.priority||'',due:x.due||'',status:x.status||'',cost:Number(x.cost||0),done:Boolean(x.done)}));
  out.tripFolders=safeArray(raw.tripFolders).map(x=>({...x,id:x.id||id('tf')}));
  out.tripSections=safeArray(raw.tripSections).map(x=>({...x,id:x.id||id('ts')}));
  out.trips=safeArray(raw.trips).filter(x=>x.type!=='Reis').map(x=>({...x,id:x.id||id('t'),checkable:Boolean(x.checkable),done:Boolean(x.done)}));
  out.dailyAnswers=raw.dailyAnswers&&typeof raw.dailyAnswers==='object'?raw.dailyAnswers:{};
  // Eén prijs-track per uniek voorraadproduct; boodschappen met dezelfde titel koppelen mee.
  const byName=new Map();
  out.stock.forEach(item=>{
    const key=norm(item.title); if(!key) return;
    let track=byName.get(key);
    if(!track){ track=normalizeTrack({label:item.title,query:item.title}); out.priceTracks.push(track); byName.set(key,track); }
    item.priceTrackId=track.id;
  });
  out.groceries.forEach(item=>{ const track=byName.get(norm(item.title)); if(track) item.priceTrackId=track.id; });
  out.meta.updatedAt=new Date().toISOString();
  return out;
}

export class Store{
  constructor(){ this.data=this.load(); this.listeners=new Set(); }
  load(){
    try{ const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); return raw?migrate(raw):defaultData(); }
    catch{ return defaultData(); }
  }
  save({touch=true}={}){
    if(touch) this.data.meta.updatedAt=new Date().toISOString();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(this.data));
    this.emit();
  }
  emit(){ this.listeners.forEach(fn=>fn(this.data)); }
  subscribe(fn){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); }
  replace(next){ this.data=migrate(next); this.save(); }
  reset(){ this.data=defaultData(); this.save(); }
  add(collection,item){ this.data[collection].push(item); this.save(); return item; }
  update(collection,itemId,patch){ const x=this.data[collection].find(x=>x.id===itemId); if(!x)return null; Object.assign(x,patch); this.save(); return x; }
  remove(collection,itemId){ const i=this.data[collection].findIndex(x=>x.id===itemId); if(i<0)return false; this.data[collection].splice(i,1); this.save(); return true; }
  getTrack(id){ return this.data.priceTracks.find(x=>x.id===id); }
  ensureTrack(label,query=label){
    const key=norm(query||label);
    let t=this.data.priceTracks.find(x=>norm(x.query)===key);
    if(!t){ t=normalizeTrack({label,query}); this.data.priceTracks.push(t); }
    return t;
  }
  cleanupTracks(){
    const used=new Set([...this.data.stock,...this.data.groceries].map(x=>x.priceTrackId).filter(Boolean));
    this.data.priceTracks=this.data.priceTracks.filter(t=>used.has(t.id));
  }
  export(){ return JSON.stringify(this.data,null,2); }
}

export const store=new Store();
