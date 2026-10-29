import {store,migrate,migrateProduction,defaultData} from './store.js';
import {todayISO,addDays,startOfWeek,weekDates,fmtDate,id,esc,groupBy,number,money,norm,toast,humanAge} from './utils.js';
import {refreshPriceTracks,priceSummary,priceStatus,learnedThresholds,stockToGroceries,linkPriceTrackToItem} from './prices.js';
import {syncNow,syncConfigured} from './sync.js';
import {IMPORT_TARGETS,parseImportText,commitImported,readImportFile} from './importer.js';
import {weather,openFoodFacts,openPrices,rdw,cbsFuel,overheidSearch,nedEnergy,extractOpenPrices,airQuality,euFuelSummary,germanFuelStations} from './sources.js';

const SECTIONS={
  today:['Vandaag','⌂'], planning:['Agenda','▦'], meals:['Weekmenu','♨'], groceries:['Boodschappen','🛒'],
  chores:['Huishouden','✓'], stock:['Voorraad','▣'], ideas:['Ideeën','♡'], home:['Woning','⌂'], cars:['Auto’s','🚗'], data:['Open data','◎'],
  trips:['Reizen','✈'], imports:['Import','↧'], settings:['Instellingen','⚙']
};
const GROCERY_CATEGORIES=['Groente','Fruit','Brood & wraps','Zuivel & vega','Vlees & vis','Diepvries','Voorraadkast','Kruiden & sauzen','Drinken','Schoonmaak','Persoonlijke verzorging','Overig'];
const STOCK_CATEGORIES=['Voorraadkast','Koelkast','Vriezer','Badkamer','Schoonmaak','Persoonlijke verzorging','Overig'];
const FREQUENCIES=['Eenmalig','Dagelijks','Om de dag','2× per week','3× per week','Wekelijks','Elke 2 weken','Elke 4 weken','Maandelijks','Elke 2 maanden','Elke 3 maanden','Elke 6 maanden','Jaarlijks','Wanneer nodig'];
const QUESTIONS=[
  'Wat gaf je vandaag onverwacht veel energie?','Welke kleine gewoonte van ons waardeer je het meest?','Waar kijk je deze week samen het meest naar uit?',
  'Wat zou je graag vaker samen doen zonder dat het veel hoeft te kosten?','Wanneer voelde jij je deze week echt gezien?','Wat kunnen we morgen doen om de dag fijner te maken?',
  'Welke herinnering aan ons maakt je direct aan het lachen?','Wat is iets kleins waar je op dit moment trots op bent?','Welke plek zouden we samen nog eens willen ontdekken?',
  'Wat heb je vandaag nodig: rust, hulp, aandacht of iets anders?','Welke maaltijd zouden we binnenkort samen willen maken?','Wat vind je fijn aan hoe we ons huis samen maken?',
  'Welke taak zou deze week eerlijker of slimmer verdeeld kunnen worden?','Wat was het mooiste moment van je dag?','Welke droom wil je de komende tijd meer ruimte geven?',
  'Wat zou een perfecte vrije ochtend voor ons zijn?','Waarvoor ben je vandaag dankbaar in onze relatie?','Wat wil je dat ik deze week niet vergeet?',
  'Wat is iets nieuws dat we samen zouden kunnen proberen?','Welke eigenschap van de ander bewonder je?','Wat helpt jou om na een drukke dag thuis te landen?',
  'Welke traditie zouden we samen willen beginnen?','Wat betekent een gezellig huis voor jou?','Waar kunnen we deze maand bewust tijd voor maken?'
];
const QUOTES=['Kleine routines maken een rustig huis.','Goed geregeld hoeft niet ingewikkeld te zijn.','Samen plannen geeft ruimte voor spontaniteit.','Wat je bijhoudt, kun je slimmer maken.','Een fijn huis is vooral een plek die voor jullie werkt.'];

let current='today';
let agendaWeek=startOfWeek(todayISO());
let choreWeek=startOfWeek(todayISO());
let editContext=null;
let importState={target:'planning',text:'',preview:[],filename:''};
let priceBusy=false;
let syncBusy=false;

function setupNav(){
  document.querySelector('#nav').innerHTML=Object.entries(SECTIONS).map(([key,[label,icon]])=>`<button class="nav-item ${key===current?'active':''}" data-view="${key}"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span></button>`).join('');
}
function navigate(view){ if(!SECTIONS[view])return; current=view; setupNav(); render(); window.scrollTo({top:0,behavior:'smooth'}); }
function updateHeader(){
  const [label]=SECTIONS[current]; document.querySelector('#pageTitle').textContent=label;
  document.querySelector('#eyebrow').textContent='Samen Thuis β • testomgeving';
  const add=document.querySelector('#addBtn');
  add.hidden=['today','imports','settings'].includes(current);
  const price=document.querySelector('#priceRefreshBtn'); price.hidden=!['stock','groceries'].includes(current);
  const sync=document.querySelector('#syncState');
  sync.textContent=syncBusy?'Synchroniseren…':syncConfigured(store.data)?`Beta sync${store.data.settings.lastSyncedAt?` · ${humanAge(store.data.settings.lastSyncedAt)}`:''}`:'Alleen lokaal';
}
function render(){
  updateHeader();
  const map={today:renderToday,planning:renderPlanning,meals:renderMeals,groceries:renderGroceries,chores:renderChores,stock:renderStock,ideas:renderIdeas,home:renderHome,cars:renderCars,data:renderDataSources,trips:renderTrips,imports:renderImports,settings:renderSettings};
  document.querySelector('#view').innerHTML=map[current]();
}
function savedFlash(){ const el=document.querySelector('#saveState'); el.textContent='Zojuist bewaard'; setTimeout(()=>el.textContent='Bewaard',1000); }
let syncSchedule;
store.subscribe(()=>{
  savedFlash();
  if(current!=='imports') render();
  if(!syncBusy&&syncConfigured(store.data)){ clearTimeout(syncSchedule); syncSchedule=setTimeout(()=>doSync(true),1400); }
});

function rowActions(collection,item){ return `<div class="row-actions"><button class="action-icon" data-edit="${collection}:${item.id}" title="Bewerken">✎</button><button class="action-icon delete" data-delete="${collection}:${item.id}" title="Verwijderen">×</button></div>`; }
function questionForToday(){ const n=Math.floor(new Date(`${todayISO()}T12:00:00`).getTime()/86400000); return QUESTIONS[Math.abs(n)%QUESTIONS.length]; }
function quoteForToday(){ const n=Math.floor(new Date(`${todayISO()}T12:00:00`).getTime()/86400000); return QUOTES[Math.abs(n)%QUOTES.length]; }
function trackFor(item){ return item.priceTrackId?store.getTrack(item.priceTrackId):null; }
function renderDailyQuestion(){
  const answers=store.data.dailyAnswers[todayISO()]||{}, both=Boolean(answers.Kees&&answers.Daphne);
  return `<section class="card question-card"><div class="card-head"><div><p class="eyebrow">Vraag van vandaag</p><h2>${esc(questionForToday())}</h2></div><span class="tag purple">Samen</span></div>
    ${both?`<div class="answer-grid"><div class="answer"><strong>Kees</strong><p>${esc(answers.Kees.answer)}</p></div><div class="answer"><strong>Daphne</strong><p>${esc(answers.Daphne.answer)}</p></div></div>`:`<p class="muted">Antwoorden worden pas allebei zichtbaar zodra jullie allebei hebben geantwoord.</p><div class="button-row">${['Kees','Daphne'].map(p=>answers[p]?`<button class="secondary" disabled>${p} ✓</button>`:`<button class="primary" data-answer="${p}">${p} beantwoordt</button>`).join('')}</div>`}
  </section>`;
}
function renderToday(){
  const low=store.data.stock.filter(x=>Number(x.amount)<=Number(x.min));
  const openGroceries=store.data.groceries.filter(x=>!x.done);
  const todayEvents=store.data.planning.filter(x=>x.date===todayISO());
  const chores=occurrencesForDate(todayISO()).filter(x=>!isChoreDone(x,todayISO()));
  const meal=store.data.meals.find(x=>x.date===todayISO()&&x.type==='Avondeten');
  const floorDeals=store.data.priceTracks.filter(t=>priceStatus(t).code==='floor');
  return `<section class="card welcome beta-warning"><div><p class="eyebrow">Bèta-versie</p><h2>Test nieuwe functies zonder je huidige app te wijzigen.</h2><p>${meal?`Vanavond: <strong>${esc(meal.title)}</strong>.`:'Het avondeten is nog niet ingevuld.'}</p></div><div class="date-chip">${fmtDate(todayISO(),{weekday:'long',day:'numeric',month:'long'})}</div></section>
    <div class="stat-row"><div class="stat"><strong>${chores.length}</strong><span>taken vandaag</span></div><div class="stat"><strong>${openGroceries.length}</strong><span>boodschappen</span></div><div class="stat"><strong>${low.length}</strong><span>bijna op</span></div><div class="stat"><strong>${floorDeals.length}</strong><span>bodemprijzen</span></div></div>
    <div class="grid two">${renderDailyQuestion()}<section class="card quote-card"><p class="eyebrow">Thuisgedachte</p><blockquote>${esc(quoteForToday())}</blockquote></section></div>
    <div class="grid two section-title">
      <section class="card"><div class="card-head"><h2>Vandaag op de agenda</h2><button class="text-btn" data-view="planning">Agenda</button></div><div class="list">${todayEvents.map(x=>simpleRow(x.title,`${x.time||'Hele dag'}${x.person?` · ${x.person}`:''}`)).join('')||empty('Geen afspraken vandaag')}</div></section>
      <section class="card"><div class="card-head"><h2>Boodschappen</h2><button class="text-btn" data-view="groceries">Open lijst</button></div><div class="list">${openGroceries.slice(0,6).map(groceryRow).join('')||empty('De lijst is leeg')}</div></section>
      <section class="card"><div class="card-head"><h2>Voorraad aanvullen</h2><button class="text-btn" data-view="stock">Voorraad</button></div><div class="list">${low.slice(0,6).map(x=>simpleRow(x.title,`${x.amount} ${esc(x.unit||'')} in huis`,priceSummary(trackFor(x),{compact:true}))).join('')||empty('Alles is op peil')}</div></section>
      <section class="card"><div class="card-head"><h2>Taken vandaag</h2><button class="text-btn" data-view="chores">Huishouden</button></div><div class="list">${chores.slice(0,6).map(choreRow).join('')||empty('Geen taken voor vandaag')}</div></section>
    </div>`;
}
function empty(text){ return `<div class="empty">${esc(text)}</div>`; }
function simpleRow(title,sub,right=''){ return `<div class="list-item"><div class="item-main"><strong>${esc(title)}</strong><small>${esc(sub)}</small></div>${right||''}</div>`; }

function renderWeekControls(type,start){ return `<div class="week-controls"><button class="secondary" data-week="${type}:-1">←</button><button class="secondary" data-week="${type}:0">Deze week</button><strong>${fmtDate(start,{day:'numeric',month:'short'})} – ${fmtDate(addDays(start,6),{day:'numeric',month:'short',year:'numeric'})}</strong><button class="secondary" data-week="${type}:1">→</button></div>`; }
function renderPlanning(){
  const days=weekDates(agendaWeek);
  return `${renderWeekControls('agenda',agendaWeek)}<div class="week">${days.map(day=>`<section class="day ${day===todayISO()?'today':''}"><div class="day-name">${fmtDate(day,{weekday:'long'})}</div><div class="day-date">${new Date(`${day}T12:00:00`).getDate()}</div>${store.data.planning.filter(x=>x.date===day).sort((a,b)=>(a.time||'').localeCompare(b.time||'')).map(x=>`<article class="calendar-event"><small>${esc(x.time||'Hele dag')}${x.endTime?`–${esc(x.endTime)}`:''}</small><strong>${esc(x.title)}</strong><span>${esc(x.calendar||'Persoonlijk')}${x.person?` · ${esc(x.person)}`:''}</span>${rowActions('planning',x)}</article>`).join('')||'<p class="day-empty">Vrij</p>'}</section>`).join('')}</div>`;
}
function renderMeals(){
  const days=weekDates(startOfWeek(todayISO()));
  return `<div class="week">${days.map(day=>`<section class="day ${day===todayISO()?'today':''}"><div class="day-name">${fmtDate(day,{weekday:'long'})}</div><div class="day-date">${new Date(`${day}T12:00:00`).getDate()}</div>${store.data.meals.filter(x=>x.date===day).map(x=>`<article class="meal"><small>${esc(x.type)}</small><strong>${esc(x.title)}</strong>${x.note?`<small>${esc(x.note)}</small>`:''}${rowActions('meals',x)}</article>`).join('')||'<p class="day-empty">Nog open</p>'}</section>`).join('')}</div>`;
}
function groceryRow(item){
  const track=trackFor(item);
  return `<div class="list-item ${item.done?'is-done':''}"><button class="check ${item.done?'done':''}" data-toggle-grocery="${item.id}">${item.done?'✓':''}</button><div class="item-main"><strong class="${item.done?'done-text':''}">${esc(item.title)}</strong><small>${item.amount||1} ${esc(item.unit||'')} ${item.store?`· ${esc(item.store)}`:''}${item.source==='stock'?' · vanuit Voorraad':''}</small><div class="grocery-meta">${track?priceSummary(track,{compact:true}):''}</div></div>${rowActions('groceries',item)}</div>`;
}
function renderGroceries(){
  const groups=groupBy(store.data.groceries,x=>x.category||'Overig');
  return `<section class="card notice"><div class="card-head"><div><p class="eyebrow">Slimme lijst</p><h2>Voorraad en prijzen werken samen</h2></div><button class="secondary" data-refresh-prices>↻ Prijzen vernieuwen</button></div><p>Producten onder hun minimum kunnen automatisch op deze lijst komen. Een prijs wordt alleen als <strong>bodemprijs</strong> gemarkeerd als je zelf een grens hebt ingesteld of als er voldoende eigen prijshistorie is.</p><p class="muted">Prijsbron: <a href="https://www.prijsprofeet.nl" target="_blank" rel="noopener">PrijsProfeet</a> · gratis publieke API</p></section>
    <div class="grid three grocery-groups section-title">${GROCERY_CATEGORIES.map(cat=>{const items=groups[cat]||[];if(!items.length)return'';return `<section class="card"><div class="card-head"><h2>${esc(cat)}</h2><span class="tag">${items.filter(x=>!x.done).length} open</span></div><div class="list">${items.map(groceryRow).join('')}</div></section>`}).join('')||empty('Nog geen boodschappen')}</div>`;
}
function isChoreDone(chore,date){ return Array.isArray(chore.completedDates)&&chore.completedDates.includes(date); }
function occurs(chore,date){
  if(!chore.nextDate||date<chore.nextDate)return false;
  const diff=Math.round((new Date(`${date}T12:00:00`)-new Date(`${chore.nextDate}T12:00:00`))/86400000);
  switch(chore.frequency){case'Dagelijks':return true;case'Om de dag':return diff%2===0;case'2× per week':return diff%3===0||diff%4===0;case'3× per week':return [0,2,4].includes(diff%7);case'Wekelijks':return diff%7===0;case'Elke 2 weken':return diff%14===0;case'Elke 4 weken':return diff%28===0;case'Maandelijks':return new Date(`${date}T12:00:00`).getDate()===new Date(`${chore.nextDate}T12:00:00`).getDate();case'Eenmalig':return diff===0;default:return diff===0;}
}
function occurrencesForDate(date){ return store.data.chores.filter(c=>occurs(c,date)); }
function choreRow(chore,date=todayISO()){ const done=isChoreDone(chore,date); return `<div class="list-item ${done?'is-done':''}"><button class="check ${done?'done':''}" data-toggle-chore="${chore.id}:${date}">${done?'✓':''}</button><div class="item-main"><strong class="${done?'done-text':''}">${esc(chore.title)}</strong><small>${esc(chore.person||'Samen')} · ${esc(chore.frequency||'')}</small></div>${rowActions('chores',chore)}</div>`; }
function renderChores(){
  const days=weekDates(choreWeek), occur=days.flatMap(d=>occurrencesForDate(d).map(c=>[c,d])); const done=occur.filter(([c,d])=>isChoreDone(c,d)).length; const pct=occur.length?Math.round(done/occur.length*100):0;
  return `<section class="household-board"><div class="trip-toolbar"><div><p class="eyebrow">Huishoudschema</p><h2>${done} van ${occur.length} afgerond</h2></div>${renderWeekControls('chores',choreWeek)}</div><div class="progress"><span style="width:${pct}%"></span></div><div class="household-week">${days.map(d=>`<section class="household-day"><div class="household-day-title"><span>${fmtDate(d,{weekday:'short'})}</span><strong>${new Date(`${d}T12:00:00`).getDate()}</strong></div>${occurrencesForDate(d).map(c=>`<div class="household-item"><button class="check ${isChoreDone(c,d)?'done':''}" data-toggle-chore="${c.id}:${d}">${isChoreDone(c,d)?'✓':''}</button><div class="item-main"><strong>${esc(c.title)}</strong><small>${esc(c.person||'Samen')}</small></div></div>`).join('')||'<p class="muted">Geen taken</p>'}</section>`).join('')}</div></section>
    <h2 class="section-title">Taakregels</h2><div class="grid three">${['Kees','Daphne','Samen'].map(p=>`<section class="card"><div class="card-head"><h2>${p}</h2><span class="tag">${store.data.chores.filter(c=>c.person===p).length}</span></div><div class="list">${store.data.chores.filter(c=>c.person===p).map(c=>`<div class="list-item"><div class="item-main"><strong>${esc(c.title)}</strong><small>${esc(c.frequency)} · vanaf ${fmtDate(c.nextDate)}</small></div>${rowActions('chores',c)}</div>`).join('')||empty('Geen taakregels')}</div></section>`).join('')}</div>`;
}
function renderStock(){
  const sorted=[...store.data.stock].sort((a,b)=>Number(Number(b.amount)<=Number(b.min))-Number(Number(a.amount)<=Number(a.min)));
  return `<section class="card notice good"><div class="card-head"><div><p class="eyebrow">Bodemprijzen</p><h2>Automatisch prijzen volgen</h2></div><button class="secondary" data-refresh-prices>↻ Prijzen vernieuwen</button></div><p>De app zoekt uitsluitend actuele aanbiedingen via de <strong>gratis publieke API</strong>. Pas je zoekterm aan als de match niet exact genoeg is. De app bouwt haar eigen bodemprijshistorie op.</p><p class="muted">Prijsbron: <a href="https://www.prijsprofeet.nl" target="_blank" rel="noopener">PrijsProfeet</a></p></section>
  <div class="grid three section-title">${sorted.map(item=>{const low=Number(item.amount)<=Number(item.min),track=trackFor(item);return `<section class="card stock-card"><div class="card-head"><span class="tag ${low?'red':'green'}">${low?'Aanvullen':'Op peil'}</span>${rowActions('stock',item)}</div><h2>${esc(item.title)}</h2><p class="muted">${esc(item.category||'Overig')}</p><div class="stock-controls"><button class="secondary" data-stock="${item.id}:-1">−</button><strong>${item.amount} <small>${esc(item.unit||'')}</small></strong><button class="secondary" data-stock="${item.id}:1">＋</button></div><small class="muted">Minimum ${item.min} · gewenst ${item.desired||item.min}</small>${priceSummary(track)}${track?`<small class="muted" style="display:block;margin-top:6px">Historie voor huidige match: ${learnedThresholds(track).count} unieke prijzen</small><div class="button-row" style="margin-top:8px"><button class="text-btn" data-edit-price="${item.id}">Prijsinstellingen</button></div>`:''}</section>`}).join('')||empty('Voeg voorraadproducten toe')}</div>`;
}
function renderIdeas(){ return `<div class="idea-grid">${store.data.ideas.map(x=>`<article class="card idea-card"><div class="card-head"><span class="tag purple">${esc(x.category||'Idee')}</span>${rowActions('ideas',x)}</div><div class="idea-icon">♡</div><h2>${esc(x.title)}</h2><p>${esc(x.description||'')}</p>${x.date?`<small class="muted">${fmtDate(x.date)}</small>`:''}</article>`).join('')||empty('Bewaar hier dingen die jullie samen willen doen')}</div>`; }
function renderHome(){ const groups=groupBy(store.data.home,x=>x.category||'Overig'); return `<div class="grid two">${Object.entries(groups).map(([cat,items])=>`<section class="card"><div class="card-head"><h2>${esc(cat)}</h2><span class="tag">${items.length}</span></div><div class="list">${items.map(x=>`<div class="list-item"><div class="item-main"><strong>${esc(x.title)}</strong><small>${esc(x.description||'')}${x.due?` · ${fmtDate(x.due)}`:''}${x.cost?` · ${money(x.cost)}`:''}</small></div>${rowActions('home',x)}</div>`).join('')}</div></section>`).join('')||empty('Nog geen woninginformatie')}</div>`; }

function carById(id){return (store.data.cars||[]).find(x=>x.id===id);}
function fuelForCar(id){return (store.data.fuelEntries||[]).filter(x=>x.carId===id).sort((a,b)=>new Date(a.date)-new Date(b.date));}
function monthKey(d){return String(d||'').slice(0,7);}
function fuelStats(entries){
 const liters=entries.reduce((a,x)=>a+Number(x.liters||0),0),cost=entries.reduce((a,x)=>a+Number(x.total||0),0);
 return {liters,cost,avg:liters?cost/liters:0};
}
function consumptionForCar(id){
 const e=fuelForCar(id).filter(x=>x.fullTank&&Number(x.odometer)>0);
 if(e.length<2)return null;
 let liters=0,km=0,last=e[0];
 for(let i=1;i<e.length;i++){const cur=e[i],dist=Number(cur.odometer)-Number(last.odometer);if(dist>0){km+=dist;liters+=Number(cur.liters||0);}last=cur;}
 return km>0?{km,liters,l100:liters/km*100,kmPerLiter:liters?km/liters:0,costPerKm:fuelStats(e.slice(1)).cost/km}:null;
}

function ownFuelObservations(){
 const entries=store.data.fuelEntries||[];
 return entries.filter(x=>Number(x.pricePerLiter)>0).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function placeOwnStats(name){
 const n=norm(name),aliases={
  'oud beijerland':['oud beijerland','hoeksche waard'],
  'nieuwerkerk aan den ijssel':['nieuwerkerk'],
  'belgie nabij fijnaart':['belgie','belgië'],
  'emmerich am rhein kleve':['emmerich','kleve','duitsland']
 };
 const keys=[n,...(aliases[n]||[])];
 const rows=ownFuelObservations().filter(x=>keys.some(k=>norm(x.station||'').includes(k)));
 if(!rows.length)return null;
 const prices=rows.map(x=>Number(x.pricePerLiter)).filter(Number.isFinite);
 return {last:rows[0],min:Math.min(...prices),avg:prices.reduce((s,x)=>s+x,0)/prices.length,count:prices.length};
}
function fuelRadarCard(){
 const s=store.data.settings,cache=s.fuelRadarCache||{},eu=cache.eu||[],de=cache.de||null;
 const nl=eu.find(x=>x.country_code==='NL'),be=eu.find(x=>x.country_code==='BE');
 const fuel=s.fuelRadarFuel||'e10';
 const euFuel=(country)=>country?.fuels?.[fuel]||country?.fuels?.sp95||null;
 const nlF=euFuel(nl),beF=euFuel(be);
 const locations=s.fuelRadarLocations||[];
 const rows=locations.map(loc=>{
   const own=placeOwnStats(loc.name);
   let ref='',detail='';
   if(loc.kind==='nl'){
     ref=nlF?.avg?money(nlF.avg)+'/L NL gem.':'Eigen waarnemingen';
     detail=own?`Eigen: ${money(own.last.pricePerLiter)}/L · ${esc(own.last.date)} · ${own.count} meting(en)`:'Nog geen eigen prijs op deze plek';
   }else if(loc.kind==='be'){
     ref=beF?.avg?money(beF.avg)+'/L BE gem.':'België referentie';
     detail=beF?.min?`Landelijk bereik vanaf ${money(beF.min)}/L · geen stationniveau in gratis bron`:'Gratis bron heeft geen stationniveau';
   }else{
     const st=de?.stations?.[0];
     ref=st&&Number(st.price)>0?money(st.price)+'/L':'Duitse live prijs';
     detail=st?`${esc(st.name||'Tankstation')} · ${esc(st.place||'')} · ${Number(st.dist||0).toFixed(1)} km vanaf zoekpunt`:'Voeg Tankerkönig-key toe en vernieuw';
   }
   return `<div class="fuel-radar-row"><div><strong>${esc(loc.name)}</strong><small>${esc(loc.note||'')}</small></div><div class="right"><strong>${ref}</strong><small>${detail}</small></div></div>`;
 }).join('');
 const cbs=store.data.settings.dataSourcesCache?.fuel;
 return `<section class="card fuel-radar"><div class="card-head"><div><p class="eyebrow">Brandstofradar</p><h2>Waar tanken langs jullie vaste plekken?</h2></div><button class="primary" data-fuel-radar-refresh>↻ Vernieuwen</button></div>
 <div class="button-row fuel-choice"><button class="${fuel==='e10'?'primary':'secondary'}" data-fuel-kind="e10">Euro 95 / E10</button><button class="${fuel==='e5'?'primary':'secondary'}" data-fuel-kind="e5">Euro 98 / E5</button><button class="${fuel==='diesel'?'primary':'secondary'}" data-fuel-kind="diesel">Diesel</button></div>
 <p class="muted">Nederland/België: gratis Europese landreferentie + jullie eigen tankwaarnemingen. Duitsland: actuele stations via Tankerkönig wanneer de gratis API-key is ingesteld.</p>
 <div class="fuel-radar-list">${rows}</div>
 <div class="fuel-radar-foot">${cbs?`CBS NL laatste daggemiddelde: ${esc(cbs.period||'')} · Euro95 ${money(cbs.values?.['Benzine Euro95'])}`:'CBS-referentie nog niet geladen.'}</div>
 <div class="button-row"><a class="secondary button-link" href="https://www.anwb.nl/auto/brandstof/goedkoopste-tankstation" target="_blank" rel="noopener">ANWB actuele NL-prijzen</a><a class="secondary button-link" href="https://directlease.nl/tankservice/" target="_blank" rel="noopener">DirectLease Tankservice</a></div>
 </section>`;
}
async function refreshFuelRadar(){
 const c=store.data.settings.fuelRadarCache ||= {};
 try{
   const [eu,de]=await Promise.allSettled([
     euFuelSummary(),
     germanFuelStations(store.data,{place:'Emmerich am Rhein',fuel:store.data.settings.fuelRadarFuel||'e10',radius:25})
   ]);
   if(eu.status==='fulfilled')c.eu=eu.value;
   if(de.status==='fulfilled')c.de=de.value;
   else c.deError=de.reason?.message||String(de.reason||'');
   c.updated=new Date().toISOString();
   store.save();
   toast(de.status==='fulfilled'?'Brandstofradar bijgewerkt':'Radar bijgewerkt; Duitsland wacht op Tankerkönig-key');
 }catch(e){console.error(e);toast(`Brandstofradar: ${e.message}`);}
}
function renderCars(){
 const cars=store.data.cars||[], entries=store.data.fuelEntries||[], mk=new Date().toISOString().slice(0,7);
 const monthly=entries.filter(x=>monthKey(x.date)===mk), ms=fuelStats(monthly);
 return `${fuelRadarCard()}<section class="card notice good"><p class="eyebrow">Auto & brandstof</p><h2>${money(ms.cost)} deze maand</h2><p>${monthly.length} tankbeurt(en) · ${ms.liters.toFixed(1)} liter · gemiddeld ${money(ms.avg)}/L. Dit totaal kan automatisch in Budget worden opgenomen.</p><div class="button-row"><button class="primary" data-car-add>Auto toevoegen</button><button class="secondary" data-fuel-add>Tankbeurt toevoegen</button></div></section>
 <div class="grid two">${cars.length?cars.map(c=>{const e=fuelForCar(c.id),st=fuelStats(e.filter(x=>monthKey(x.date)===mk)),con=consumptionForCar(c.id),last=e[e.length-1];return `<section class="card"><div class="card-head"><div><p class="eyebrow">${esc(c.nickname||'Auto')}</p><h2>${esc(c.brand||'')} ${esc(c.model||'')}</h2></div><button class="icon-button" data-car-edit="${c.id}">✎</button></div><p>${esc(c.plate||'Geen kenteken')} ${c.fuelType?`· ${esc(c.fuelType)}`:''}</p><div class="metric-grid"><div><small>Deze maand</small><strong>${money(st.cost)}</strong></div><div><small>Liters</small><strong>${st.liters.toFixed(1)}</strong></div><div><small>Verbruik</small><strong>${con?con.l100.toFixed(1)+' L/100 km':'–'}</strong></div><div><small>€/km</small><strong>${con?money(con.costPerKm):'–'}</strong></div></div>${last?`<p class="muted">Laatste stand: ${Number(last.odometer||0).toLocaleString('nl-NL')} km · ${esc(last.date)}</p>`:''}<div class="button-row"><button class="secondary" data-fuel-add="${c.id}">Tankbeurt</button><button class="ghost danger" data-car-delete="${c.id}">Verwijder</button></div></section>`}).join(''):`<section class="card empty"><h2>Nog geen auto's</h2><p>Voeg meerdere auto's toe. Tankkosten worden per auto én gezamenlijk bijgehouden.</p></section>`}</div>
 ${cars.map(c=>{const e=fuelForCar(c.id).slice().reverse();return e.length?`<section class="card"><p class="eyebrow">${esc(c.nickname||c.plate||'Auto')}</p><h2>Tankhistorie</h2><div class="list">${e.slice(0,12).map(x=>`<div class="list-row"><div><strong>${esc(x.date)}</strong><small>${Number(x.odometer||0).toLocaleString('nl-NL')} km · ${Number(x.liters||0).toFixed(2)} L · ${x.station?esc(x.station):'tankstation niet ingevuld'}</small></div><div class="right"><strong>${money(x.total)}</strong><small>${money(x.pricePerLiter)}/L</small></div></div>`).join('')}</div></section>`:''}).join('')}`;
}
function carDialog(existing=null){
 const c=existing||{};modal(`<form id="carForm" class="form-grid"><h2 class="wide">${existing?'Auto aanpassen':'Auto toevoegen'}</h2><input type="hidden" name="id" value="${esc(c.id||'')}"><label class="field">Naam<input name="nickname" required value="${esc(c.nickname||'')}" placeholder="Auto Kees"></label><label class="field">Kenteken<input name="plate" value="${esc(c.plate||'')}"></label><label class="field">Merk<input name="brand" value="${esc(c.brand||'')}"></label><label class="field">Model<input name="model" value="${esc(c.model||'')}"></label><label class="field">Brandstof<select name="fuelType"><option>Euro 95 (E10)</option><option>Euro 98 (E5)</option><option>Diesel</option><option>LPG</option><option>Elektrisch</option></select></label><label class="field">Tankinhoud (L)<input name="tankCapacity" type="number" step=".1" value="${esc(c.tankCapacity||'')}"></label><div class="button-row wide"><button class="primary">Opslaan</button><button class="secondary" type="button" data-modal-close>Annuleren</button></div></form>`);
 const sel=document.querySelector('#carForm select[name=fuelType]');if(sel&&c.fuelType)sel.value=c.fuelType;
}
function fuelDialog(carId=''){
 const cars=store.data.cars||[];if(!cars.length){toast('Voeg eerst een auto toe');return;}
 modal(`<form id="fuelForm" class="form-grid"><h2 class="wide">Tankbeurt toevoegen</h2><label class="field">Auto<select name="carId">${cars.map(c=>`<option value="${c.id}" ${c.id===carId?'selected':''}>${esc(c.nickname||c.plate||'Auto')}</option>`).join('')}</select></label><label class="field">Datum<input required name="date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label class="field">Kilometerstand<input required name="odometer" type="number" min="0"></label><label class="field">Liters<input required name="liters" type="number" min="0" step=".01"></label><label class="field">Totaal betaald (€)<input name="total" type="number" min="0" step=".01"></label><label class="field">Prijs per liter (€)<input name="pricePerLiter" type="number" min="0" step=".001"></label><label class="field">Tankstation/plaats<input name="station" placeholder="bijv. Delft"></label><label class="check wide"><input name="fullTank" type="checkbox" checked> Volgetankt (nodig voor betrouwbare verbruiksberekening)</label><div class="button-row wide"><button class="primary">Tankbeurt opslaan</button><button class="secondary" type="button" data-modal-close>Annuleren</button></div></form>`);
}

function sourceCard(title,sub,body,action=''){return `<section class="card source-card"><div class="card-head"><div><p class="eyebrow">${esc(sub)}</p><h2>${esc(title)}</h2></div>${action}</div>${body}</section>`;}
function renderDataSources(){
 const c=store.data.settings.dataSourcesCache||{},aq=c.airQuality,w=c.weather,car=c.rdw,fuel=c.fuel,ned=c.ned,off=c.off,op=c.openPrices,gov=c.gov;
 const aqc=aq?.current||{}, pollenMax=Math.max(0,...['alder_pollen','birch_pollen','grass_pollen','mugwort_pollen','ragweed_pollen'].map(k=>Number(aqc[k]||0)));
 const allergy=pollenMax>50?'Hoog':pollenMax>10?'Verhoogd':pollenMax>1?'Laag':'Zeer laag';
 const asthma=Number(aqc.european_aqi||0)>60?'Ongunstig':Number(aqc.european_aqi||0)>40?'Matig':'Gunstig';
 const health=aq?`<div class="health-badges"><span>🌿 Pollen: <strong>${allergy}</strong></span><span>🫁 Lucht: <strong>${asthma}</strong></span></div><p>Gras ${Number(aqc.grass_pollen||0).toFixed(1)} · Berk ${Number(aqc.birch_pollen||0).toFixed(1)} · Els ${Number(aqc.alder_pollen||0).toFixed(1)} korrels/m³</p><p>EU AQI ${Math.round(aqc.european_aqi||0)} · PM2.5 ${Number(aqc.pm2_5||0).toFixed(1)} · PM10 ${Number(aqc.pm10||0).toFixed(1)} µg/m³ · ozon ${Number(aqc.ozone||0).toFixed(0)} µg/m³</p><small class="muted">Indicatie voor hooikoorts/luchtkwaliteit; geen persoonlijk medisch advies.</small>`:`<p class="muted">Laad luchtkwaliteit voor pollen, fijnstof en ozon.</p>`;
 const wb=w?`<div class="source-big">${Math.round(w.current?.temperature_2m??0)}°C</div><p>Voelt als ${Math.round(w.current?.apparent_temperature??0)}° · wind ${w.current?.wind_speed_10m??'-'} km/u</p><small class="muted">Neerslagkans vandaag ${w.daily?.precipitation_probability_max?.[0]??'-'}%</small>`:`<p class="muted">Vul coördinaten in bij Instellingen.</p>`;
 const cb=car?`<strong>${esc(car.merk||'')} ${esc(car.handelsbenaming||'')}</strong><p>${esc(car.kenteken||'')} · ${esc(car.voertuigsoort||'')}</p><small class="muted">APK: ${esc(car.vervaldatum_apk||'onbekend')}</small>`:`<p class="muted">Vul een kenteken in bij Instellingen.</p>`;
 const fb=fuel?`<div class="source-values">${Object.entries(fuel.values||{}).map(([k,v])=>`<span><small>${esc(k)}</small><strong>${money(v)}</strong></span>`).join('')}</div><small class="muted">${esc(fuel.period||'Laatste CBS-waarneming')}</small>`:`<p class="muted">Landelijke gemiddelde pompprijzen.</p>`;
 const nb=ned?`<p>Zon: <strong>${esc(ned.solar??'-')}</strong> · Wind: <strong>${esc(ned.wind??'-')}</strong></p><p>Netvraag: <strong>${esc(ned.load??'-')}</strong></p><small class="muted">${esc(ned.updated||'')}</small>`:`<p class="muted">Optioneel; gratis NED API-key via Supabase secret.</p>`;
 const ob=off?`<p><strong>${esc(off.product_name||'Product')}</strong>${off.brands?` · ${esc(off.brands)}`:''}</p><small class="muted">${esc(off.quantity||'')} ${off.nutriscore_grade?`· Nutri-Score ${esc(String(off.nutriscore_grade).toUpperCase())}`:''}</small>`:`<p class="muted">Barcode → productinformatie.</p>`;
 const pb=op?`<p>${op.length} open prijswaarneming(en).</p>${op.slice(0,4).map(x=>`<small class="muted" style="display:block">${esc(x.date||'')} · ${money(x.price)} ${esc(x.currency||'EUR')}</small>`).join('')}`:`<p class="muted">Crowdsourced prijzen per barcode.</p>`;
 const gb=gov?`<p>${gov.length} dataset(s).</p>${gov.slice(0,4).map(x=>`<small class="muted" style="display:block">${esc(x.title||'Dataset')}</small>`).join('')}`:`<p class="muted">Zoek in het Nederlandse Open Data Register.</p>`;
 return `<section class="card notice good"><p class="eyebrow">Gratis/open bronnen</p><h2>Databronnen voor Samen Thuis</h2><p>Alleen gegevens die jullie daadwerkelijk opvragen worden geladen.</p></section><div class="grid two">
 ${sourceCard('Open-Meteo','Weer',wb,'<button class="secondary" data-source="weather">Vernieuwen</button>')}
 ${sourceCard('Pollen & luchtkwaliteit','Hooikoorts / luchtwegen',health,'<button class="secondary" data-source="air">Luchtkwaliteit</button>')}
 ${sourceCard('RDW Open Data','Auto',cb,'<button class="secondary" data-source="rdw">Kenteken laden</button>')}
 ${sourceCard('CBS brandstofdata','Brandstof',fb,'<button class="secondary" data-source="fuel">Laatste prijzen</button>')}
 ${sourceCard('Nationaal Energie Dashboard','Energie',nb,'<button class="secondary" data-source="ned">Energiedata</button>')}
 ${sourceCard('Open Food Facts','Product/barcode',ob,'<button class="secondary" data-source="off">Barcode zoeken</button>')}
 ${sourceCard('Open Prices','Open prijzen',pb,'<button class="secondary" data-source="openprices">Prijzen barcode</button>')}
 ${sourceCard('Nederlandse open data','Data.overheid.nl',gb,'<button class="secondary" data-source="gov">Datasets zoeken</button>')}
 ${sourceCard('PrijsProfeet','Supermarktaanbiedingen','<p>Blijft gekoppeld aan Voorraad en Boodschappen voor actuele acties en jullie eigen bodemprijslogica.</p>','<button class="secondary" data-view="stock">Naar voorraad</button>')}
 </div><section class="card"><p class="eyebrow">Folders</p><h2>Brede folderbron</h2><p>Er is geen betrouwbare officiële gratis open API gevonden die het brede winkelaanbod van AlleFolders levert. Daarom scrapen we geen folders. Supermarktaanbiedingen lopen via PrijsProfeet.</p></section>`;
}
async function loadSource(kind){const c=store.data.settings.dataSourcesCache ||= {};try{
 if(kind==='air')c.airQuality=await airQuality(store.data.settings.weatherLat,store.data.settings.weatherLon);
 if(kind==='weather')c.weather=await weather(store.data.settings.weatherLat,store.data.settings.weatherLon);
 if(kind==='rdw')c.rdw=await rdw(store.data.settings.vehiclePlate);
 if(kind==='fuel'){const r=await cbsFuel();c.fuel={period:r.date,values:{'Benzine Euro95':r.petrol,'Diesel':r.diesel,'Lpg':r.lpg}};}
 if(kind==='ned'){const r=await nedEnergy(store.data);c.ned=r.summary||r;}
 if(kind==='off'){const code=prompt('Barcode (EAN)');if(!code)return;const r=await openFoodFacts(code);c.off=r.product||r;c.lastBarcode=code;}
 if(kind==='openprices'){const code=c.lastBarcode||prompt('Barcode (EAN)');if(!code)return;c.lastBarcode=code;c.openPrices=extractOpenPrices(await openPrices(code));}
 if(kind==='gov'){const q=prompt('Zoekterm Nederlandse open data',store.data.settings.openDataQuery||'energie');if(!q)return;store.data.settings.openDataQuery=q;const r=await overheidSearch(q);c.gov=r.result?.results||[];}
 store.save();toast('Bron bijgewerkt');
 }catch(e){console.error(e);toast(`Bron kon niet laden: ${e.message}`);}}

function renderTrips(){
  return `<div class="trip-toolbar"><div><p class="eyebrow">Reismappen</p><h2>Plannen, boekingen en paklijsten</h2></div><div class="button-row"><button class="secondary" data-add-folder>＋ Reis</button>${store.data.tripFolders.length?'<button class="primary" data-add-trip-item>＋ Onderdeel</button>':''}</div></div>
  ${store.data.tripFolders.map(folder=>`<section class="card trip-folder"><div class="card-head"><div><p class="eyebrow">${folder.startDate?fmtDate(folder.startDate,{day:'numeric',month:'short',year:'numeric'}):'Datum open'}${folder.endDate?` – ${fmtDate(folder.endDate,{day:'numeric',month:'short',year:'numeric'})}`:''}</p><h2>📁 ${esc(folder.name)}</h2><p class="muted">${esc(folder.note||'')}</p></div><div class="row-actions"><button class="action-icon" data-edit-folder="${folder.id}">✎</button><button class="action-icon delete" data-delete-folder="${folder.id}">×</button></div></div>${store.data.tripSections.filter(s=>s.tripFolderId===folder.id).map(section=>`<div class="trip-section"><div class="card-head"><h3>📂 ${esc(section.name)}</h3><div class="row-actions"><button class="action-icon" data-add-trip-section-item="${section.id}">＋</button><button class="action-icon delete" data-delete-section="${section.id}">×</button></div></div><div class="list">${store.data.trips.filter(t=>t.tripSectionId===section.id).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')).map(tripRow).join('')||'<p class="muted">Leeg</p>'}</div></div>`).join('')}<div class="button-row" style="margin-top:12px"><button class="secondary" data-add-section="${folder.id}">＋ Map</button></div></section>`).join('')||empty('Maak een reismap, bijvoorbeeld Vietnam')}`;
}
function tripRow(item){ return `<div class="list-item ${item.done?'is-done':''}">${item.checkable?`<button class="check ${item.done?'done':''}" data-toggle-trip="${item.id}">${item.done?'✓':''}</button>`:''}<div class="item-main"><strong class="${item.done?'done-text':''}">${esc(item.title)}</strong><small>${esc(item.type||'Notitie')}${item.date?` · ${fmtDate(item.date)}`:''}${item.location?` · ${esc(item.location)}`:''}</small></div>${rowActions('trips',item)}</div>`; }

function renderImports(){
  const example={planning:'[agenda] | Titel | 2026-09-11 | 19:00 | 20:00 | Samen | Persoonlijk | notitie',meals:'[weekmenu] | 2026-09-11 | Avondeten | Pasta | 2 | notitie',groceries:'[boodschappen] | Pasta | 2 | pakken | Voorraadkast | Dirk | nee | notitie',chores:'[huishouden] | Badkamer schoonmaken | Badkamer | Wekelijks | Samen | 2026-09-12 | Normaal | douche + wastafel + vloer',stock:'[voorraad] | Pasta | Voorraadkast | 2 | pakken | 2 | 4 |  | Keuken | notitie',ideas:'[idee] | Bioscoop | Uit | Nieuwe film kijken | Samen | Normaal | Open | ',home:'[woning] | CV onderhoud | Onderhoud | Jaarlijkse controle | Normaal | 2026-11-01 | Open | 0 | nee',trips:'[reizen] | Vietnam | Boekingen | Cruise boeken | Reservering | Lan Ha Bay | 2027-01-15 | 2027-01-16 | 2026-10-01 | Cat Ba | 250 | Hoog | ja | nee | notitie'}[importState.target];
  return `<div class="import-shell"><section class="card"><div class="card-head"><div><p class="eyebrow">Universele importer</p><h2>Plakken of bestand uploaden</h2></div></div><label class="field">Doel<select id="importTarget">${Object.entries(IMPORT_TARGETS).map(([k,v])=>`<option value="${k}" ${k===importState.target?'selected':''}>${v}</option>`).join('')}</select></label><label class="field" style="margin-top:12px">Tekst<textarea id="importText" placeholder="${esc(example)}">${esc(importState.text)}</textarea></label>${importState.filename?`<p class="muted">Bestand: ${esc(importState.filename)}</p>`:''}<div class="button-row"><button class="primary" data-analyse-import>Analyseren</button><button class="secondary" data-pick-import>Bestand kiezen</button><button class="secondary" data-clear-import>Leegmaken</button></div><details style="margin-top:14px"><summary>Formaatvoorbeeld</summary><pre class="code-example">${esc(example)}</pre><p class="muted">Scheidingstekens mogen <strong>|</strong>, <strong>;</strong>, tab, <strong> / </strong> of een spatie-streep-spatie zijn. TXT, CSV, JSON, PDF, DOCX en Excel worden ondersteund wanneer je online bent.</p></details></section>
  <section class="card import-preview"><div class="card-head"><div><p class="eyebrow">Controle</p><h2>${importState.preview.length} gevonden</h2></div>${importState.preview.length?'<button class="primary" data-commit-import>Toevoegen</button>':''}</div>${importState.preview.map((x,i)=>`<label class="import-card-check"><input type="checkbox" data-import-check="${i}" ${x.selected!==false?'checked':''}><div><strong>${esc(x.item.title||x.item.name||'Item')}</strong><small class="muted">${esc(IMPORT_TARGETS[x.target])}${x.source?` · ${esc(x.source.slice(0,80))}`:''}</small></div></label>`).join('')||empty('Nog niets geanalyseerd')}</section></div>`;
}
function renderSettings(){
  const s=store.data.settings;
  return `<div class="settings-grid">
    <section class="card settings-card beta-warning"><p class="eyebrow">Veilige bèta</p><h2>Gescheiden van productie</h2><p>Deze app gebruikt <code>samenThuisBetaV1</code> als eigen opslag. Ook het synchronisatierecord krijgt automatisch een beta-prefix. Je kunt dus dezelfde Supabase-omgeving gebruiken zonder productiegegevens te overschrijven.</p><div class="button-row"><button class="secondary" data-import-production>Productie-back-up kopiëren</button><button class="secondary" data-action="backup">Beta-back-up maken</button></div></section>
    <section class="card settings-card"><p class="eyebrow">Automatisering</p><h2>Voorraad & prijzen</h2><label class="field" style="flex-direction:row;align-items:flex-start"><input id="autoStock" type="checkbox" ${s.autoStockToGroceries?'checked':''}> <span>Product automatisch op Boodschappen zetten als voorraad ≤ minimum.</span></label><label class="field" style="flex-direction:row;align-items:flex-start;margin-top:10px"><input id="autoPrice" type="checkbox" ${s.autoPriceRefresh?'checked':''}> <span>Prijs automatisch verversen als de vorige controle ouder is dan de ingestelde periode.</span></label><label class="field" style="margin-top:12px">Ververs na<select id="priceHours">${[6,12,24].map(h=>`<option value="${h}" ${Number(s.priceRefreshHours)===h?'selected':''}>${h} uur</option>`).join('')}</select></label><p class="muted">Bodemprijs wordt alleen gebruikt bij een handmatige grens of minimaal vier verschillende eigen prijswaarnemingen.</p></section>
    <section class="card settings-card"><p class="eyebrow">Synchronisatie</p><h2>Versleutelde beta-sync</h2><form id="syncForm" class="form-grid"><label class="field wide">Supabase Project URL<input name="supabaseUrl" value="${esc(s.supabaseUrl)}" required></label><label class="field wide">Publishable / anon key<input name="supabaseAnonKey" value="${esc(s.supabaseAnonKey)}" required></label><label class="field wide">Geheime huishoudcode<input name="householdCode" type="password" minlength="12" value="${esc(s.householdCode)}" placeholder="Minimaal 12 tekens"></label><div class="button-row wide"><button class="primary">Bewaren & synchroniseren</button><button class="secondary" type="button" data-sync-now>Nu synchroniseren</button></div></form><p class="muted">De huishoudcode staat alleen lokaal. De appdata wordt vóór verzending met AES-GCM versleuteld.</p></section>
    <section class="card settings-card"><p class="eyebrow">Gratis prijsservice</p><h2>PrijsProfeet via Supabase</h2><p>Deze bèta gebruikt alleen de <strong>gratis publieke endpoints</strong> van PrijsProfeet. Er is geen betaald abonnement nodig. De Edge Function vraagt alleen actieve aanbiedingen op en de app bewaart zelf haar eigen prijswaarnemingen.</p><div class="button-row"><button class="secondary" data-refresh-prices>Prijsservice testen</button><a class="secondary" href="https://www.prijsprofeet.nl" target="_blank" rel="noopener">PrijsProfeet openen</a></div><p class="muted">Bronvermelding is verplicht bij gratis API-gebruik. Er worden geen Pro-endpoints gebruikt.</p></section>
    <section class="card settings-card"><p class="eyebrow">Open databronnen</p><h2>Weer, auto & overheid</h2><form id="sourceSettingsForm" class="form-grid"><label class="field">Breedtegraad<input name="weatherLat" type="number" step="0.000001" value="${esc(s.weatherLat||'')}"></label><label class="field">Lengtegraad<input name="weatherLon" type="number" step="0.000001" value="${esc(s.weatherLon||'')}"></label><label class="field">Kenteken<input name="vehiclePlate" value="${esc(s.vehiclePlate||'')}" placeholder="AB-12-CD"></label><label class="field">Open-data zoekterm<input name="openDataQuery" value="${esc(s.openDataQuery||'energie')}"></label><div class="button-row wide"><button class="primary">Broninstellingen bewaren</button><button class="secondary" type="button" data-view="data">Open databronnen</button></div></form><p class="muted">NED gebruikt <code>NED_API_KEY</code> als Supabase secret. Geheime sleutels horen niet in GitHub.</p></section>
    <section class="card settings-card"><p class="eyebrow">Gegevens</p><h2>Back-up & reset</h2><div class="button-row"><button class="secondary" data-action="backup">Back-up maken</button><button class="secondary" data-action="restore">Back-up laden</button><button class="danger" data-reset-beta>Beta leegmaken</button></div></section>
  </div>`;
}

function formConfig(collection,item={}){
  const track=trackFor(item)||{};
  const defaultTrack=Boolean(item.priceTrackId)||(collection==='stock'&&!item.id);
  const commonTrack=[['trackPrice','Prijs volgen','checkbox',null,defaultTrack],['priceQuery','Zoekterm prijs','text',null,track.query||item.title||''],['manualGood','Goede prijs (€)','number',null,track.manualGood??''],['manualFloor','Bodemprijs (€)','number',null,track.manualFloor??''],['preferredRetailer','Voorkeurswinkel','text',null,track.preferredRetailer||'']];
  const configs={
    planning:{title:'Agenda-item',fields:[['title','Titel','text'],['date','Datum','date'],['time','Begintijd','time'],['endTime','Eindtijd','time'],['person','Voor wie','select',['Kees','Daphne','Samen']],['calendar','Agenda','text'],['note','Notitie','textarea']]},
    meals:{title:'Maaltijd',fields:[['date','Datum','date'],['type','Moment','select',['Ontbijt','Lunch','Avondeten','Snack']],['title','Gerecht','text'],['persons','Personen','text'],['note','Notitie','textarea']]},
    groceries:{title:'Boodschap',fields:[['title','Product','text'],['amount','Hoeveelheid','number'],['unit','Eenheid','text'],['category','Categorie','select',GROCERY_CATEGORIES],['store','Winkel','text'],['done','Al gekocht','checkbox'],['note','Notitie','textarea'],...commonTrack]},
    chores:{title:'Huishoudtaak',fields:[['title','Taak','text'],['category','Ruimte / categorie','text'],['frequency','Frequentie','select',FREQUENCIES],['person','Voor wie','select',['Kees','Daphne','Samen']],['nextDate','Startdatum','date'],['priority','Prioriteit','select',['Laag','Normaal','Hoog']],['notes','Omschrijving / subtaken','textarea']]},
    stock:{title:'Voorraadproduct',fields:[['title','Product','text'],['category','Categorie','select',STOCK_CATEGORIES],['amount','In huis','number'],['min','Minimum','number'],['desired','Gewenst','number'],['unit','Eenheid','text'],['location','Locatie','text'],['bestBefore','Houdbaar tot','date'],['note','Notitie','textarea'],...commonTrack]},
    ideas:{title:'Idee',fields:[['title','Titel','text'],['category','Categorie','select',['Thuis','Uit','Actief','Gratis','Eten','Reizen']],['description','Omschrijving','textarea'],['person','Voor wie','select',['','Kees','Daphne','Samen']],['priority','Prioriteit','select',['','Laag','Normaal','Hoog']],['status','Status','select',['','Open','Gepland','Gedaan']],['date','Datum / deadline','date']]},
    home:{title:'Woningitem',fields:[['title','Titel','text'],['category','Categorie','select',['Onderhoud','Klus','Garantie','Veiligheid','Organisatie','Woninginfo','Handleiding']],['description','Omschrijving','textarea'],['priority','Prioriteit','select',['','Laag','Normaal','Hoog']],['due','Deadline','date'],['status','Status','text'],['cost','Kosten (€)','number'],['done','Afgerond','checkbox']]},
    trips:{title:'Reisonderdeel',fields:[['tripFolderId','Reis','select',store.data.tripFolders.map(f=>[f.id,f.name])],['tripSectionId','Map','select',store.data.tripSections.map(s=>[s.id,`${store.data.tripFolders.find(f=>f.id===s.tripFolderId)?.name||''} › ${s.name}`])],['title','Titel','text'],['type','Type','select',['Voorbereiding','Reservering','Vervoer','Verblijf','Activiteit','Eten','Budget','Documenten','Paklijst','Notitie']],['date','Datum / deadline','date'],['location','Locatie','text'],['cost','Kosten (€)','number'],['priority','Prioriteit','select',['','Laag','Normaal','Hoog']],['checkable','Afvinken','checkbox'],['done','Afgerond','checkbox'],['note','Notitie','textarea']]}
  };
  return configs[collection];
}
function fieldHtml(field,item){
  const [name,label,type,options,override]=field; const value=override!==undefined?override:(item[name]??''); const wide=['textarea'].includes(type)||['note','notes','description','priceQuery'].includes(name);
  if(type==='checkbox') return `<label class="field ${wide?'wide':''}" style="flex-direction:row;align-items:center"><input type="checkbox" name="${name}" ${value?'checked':''}> <span>${esc(label)}</span></label>`;
  if(type==='select') return `<label class="field ${wide?'wide':''}">${esc(label)}<select name="${name}">${(options||[]).map(opt=>{const pair=Array.isArray(opt)?opt:[opt,opt];return `<option value="${esc(pair[0])}" ${String(value)===String(pair[0])?'selected':''}>${esc(pair[1])}</option>`}).join('')}</select></label>`;
  if(type==='textarea') return `<label class="field wide">${esc(label)}<textarea name="${name}">${esc(value)}</textarea></label>`;
  const step=type==='number'?'step="0.01"':''; return `<label class="field ${wide?'wide':''}">${esc(label)}<input name="${name}" type="${type}" ${step} value="${esc(value)}" ${name==='title'?'required':''}></label>`;
}
function openForm(collection,itemId=null,pre={}){
  const cfg=formConfig(collection); if(!cfg)return;
  let item=itemId?store.data[collection].find(x=>x.id===itemId):{}; item={...item,...pre}; editContext={collection,itemId};
  document.querySelector('#dialogEyebrow').textContent=itemId?'Bewerken':'Nieuw'; document.querySelector('#dialogTitle').textContent=cfg.title;
  document.querySelector('#formFields').innerHTML=cfg.fields.map(f=>fieldHtml(f,item)).join(''); document.querySelector('#itemDialog').showModal();
}
function saveForm(event){
  event.preventDefault(); if(!editContext)return; const {collection,itemId}=editContext; const fd=new FormData(event.target); const cfg=formConfig(collection); const patch={};
  for(const [name,,type] of cfg.fields){ if(['trackPrice','priceQuery','manualGood','manualFloor','preferredRetailer'].includes(name))continue; if(type==='checkbox')patch[name]=fd.get(name)==='on'; else if(type==='number')patch[name]=number(fd.get(name),0); else patch[name]=String(fd.get(name)||'').trim(); }
  let item;
  if(itemId){ item=store.data[collection].find(x=>x.id===itemId); Object.assign(item,patch); }
  else { item={id:id(collection.slice(0,1)),...patch}; if(collection==='groceries'){item.source='manual';item.priceTrackId='';} if(collection==='stock')item.priceTrackId=''; if(collection==='chores')item.completedDates=[]; store.data[collection].push(item); }
  if(collection==='trips'){
    let section=store.data.tripSections.find(s=>s.id===item.tripSectionId&&s.tripFolderId===item.tripFolderId);
    if(!section){
      section=store.data.tripSections.find(s=>s.tripFolderId===item.tripFolderId);
      if(!section){section={id:id('ts'),tripFolderId:item.tripFolderId,name:'Algemeen'};store.data.tripSections.push(section);}
      item.tripSectionId=section.id;
    }
  }
  if(['groceries','stock'].includes(collection)){
    const track=fd.get('trackPrice')==='on';
    if(track) linkPriceTrackToItem(store,collection,item,{query:fd.get('priceQuery')||item.title,manualGood:fd.get('manualGood'),manualFloor:fd.get('manualFloor'),preferredRetailer:fd.get('preferredRetailer')});
    else item.priceTrackId='';
  }
  store.cleanupTracks(); if(collection==='stock')stockToGroceries(store); store.save(); document.querySelector('#itemDialog').close(); editContext=null; toast(itemId?'Bijgewerkt':'Toegevoegd');
}

async function doRefreshPrices(force=true){
  if(priceBusy)return; priceBusy=true; document.querySelector('#priceRefreshBtn').textContent='Bezig…';
  try{ const result=await refreshPriceTracks(store,{force,onProgress:({checked,total})=>{document.querySelector('#priceRefreshBtn').textContent=`${checked}/${total}`;}}); toast(result.checked?`${result.found} actuele aanbiedingen gevonden`:'Prijzen zijn nog actueel'); }
  catch(err){ console.error(err); toast(`Prijscontrole mislukt: ${err.message}`); }
  finally{ priceBusy=false; document.querySelector('#priceRefreshBtn').textContent='↻ Prijzen'; render(); }
}
async function doSync(quiet=false){
  if(syncBusy)return; syncBusy=true; updateHeader();
  try{const result=await syncNow(store,{quiet}); if(!quiet&&result.status!=='not-configured')toast(result.status==='pulled'?'Nieuwere beta-data opgehaald':'Beta-data gesynchroniseerd');}
  catch(err){console.error(err); if(!quiet)toast(`Synchronisatie mislukt: ${err.message}`);}
  finally{syncBusy=false;updateHeader();render();}
}
function download(name,text,type='application/json'){ const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
async function loadBackup(file,production=false){
  try{ const raw=JSON.parse(await file.text()); if(production) store.replace(migrateProduction(raw)); else store.replace(migrate(raw)); stockToGroceries(store); toast(production?'Productiedata gekopieerd naar beta':'Beta-back-up geladen'); }
  catch(err){console.error(err);toast('Back-up kon niet worden gelezen');}
}
function askConfirm(title,text){
  return new Promise(resolve=>{const d=document.querySelector('#confirmDialog');document.querySelector('#confirmTitle').textContent=title;document.querySelector('#confirmText').textContent=text;d.showModal();d.addEventListener('close',()=>resolve(d.returnValue==='ok'),{once:true});});
}
function openQuestion(person){ const answers=store.data.dailyAnswers[todayISO()]||{}; if(answers[person])return toast('Dit antwoord staat al vast'); document.querySelector('#questionPerson').value=person; document.querySelector('#questionDialogTitle').textContent=`${person}, jouw antwoord`; document.querySelector('#questionDialogText').textContent=questionForToday(); document.querySelector('#questionAnswer').value=''; document.querySelector('#questionDialog').showModal(); }

// Globale events
setupNav(); render();
document.addEventListener('click',async e=>{
  const sourceBtn=e.target.closest('[data-source]'); if(sourceBtn){ loadSource(sourceBtn.dataset.source); return; }
  const addCar=e.target.closest('[data-car-add]');if(addCar){carDialog();return;}
  const editCar=e.target.closest('[data-car-edit]');if(editCar){carDialog(carById(editCar.dataset.carEdit));return;}
  const delCar=e.target.closest('[data-car-delete]');if(delCar){if(confirm('Auto en bijbehorende tankbeurten verwijderen?')){store.data.cars=store.data.cars.filter(x=>x.id!==delCar.dataset.carDelete);store.data.fuelEntries=store.data.fuelEntries.filter(x=>x.carId!==delCar.dataset.carDelete);store.save();}return;}
  const addFuel=e.target.closest('[data-fuel-add]');if(addFuel){fuelDialog(addFuel.dataset.fuelAdd||'');return;}


  const view=e.target.closest('[data-view]')?.dataset.view; if(view){navigate(view);return;}
  if(e.target.closest('#addBtn')){ if(current==='trips'){ if(!store.data.tripFolders.length) return openFolderForm(); return openForm('trips'); } openForm(current); return; }
  if(e.target.closest('[data-close-dialog]')){document.querySelector('#itemDialog').close();return;}
  if(e.target.closest('[data-close-question]')){document.querySelector('#questionDialog').close();return;}
  const edit=e.target.closest('[data-edit]')?.dataset.edit; if(edit){const [c,i]=edit.split(':');openForm(c,i);return;}
  const editPrice=e.target.closest('[data-edit-price]')?.dataset.editPrice; if(editPrice){openForm('stock',editPrice);return;}
  const del=e.target.closest('[data-delete]')?.dataset.delete; if(del){const [c,i]=del.split(':');if(await askConfirm('Verwijderen','Dit item uit de beta-app verwijderen?')){store.remove(c,i);store.cleanupTracks();store.save();}return;}
  const g=e.target.closest('[data-toggle-grocery]')?.dataset.toggleGrocery; if(g){const x=store.data.groceries.find(i=>i.id===g);if(x){const next=!x.done;if(x.source==='stock'&&x.stockId){const stock=store.data.stock.find(s=>s.id===x.stockId);if(stock){const qty=Math.max(0,Number(x.amount||0));if(next&&!x.purchasedApplied){stock.amount=Number(stock.amount||0)+qty;x.purchasedApplied=true;}else if(!next&&x.purchasedApplied){stock.amount=Math.max(0,Number(stock.amount||0)-qty);x.purchasedApplied=false;}}}x.done=next;store.save();}return;}
  const c=e.target.closest('[data-toggle-chore]')?.dataset.toggleChore; if(c){const [cid,date]=c.split(':');const x=store.data.chores.find(i=>i.id===cid);if(x){x.completedDates||=[];x.completedDates=x.completedDates.includes(date)?x.completedDates.filter(d=>d!==date):[...x.completedDates,date];store.save();}return;}
  const t=e.target.closest('[data-toggle-trip]')?.dataset.toggleTrip; if(t){const x=store.data.trips.find(i=>i.id===t);if(x){x.done=!x.done;store.save();}return;}
  const s=e.target.closest('[data-stock]')?.dataset.stock; if(s){const [sid,delta]=s.split(':');const x=store.data.stock.find(i=>i.id===sid);if(x){x.amount=Math.max(0,Number(x.amount)+Number(delta));store.save();stockToGroceries(store);}return;}
  const w=e.target.closest('[data-week]')?.dataset.week; if(w){const [type,delta]=w.split(':');const base=type==='agenda'?agendaWeek:choreWeek;const next=Number(delta)===0?startOfWeek(todayISO()):addDays(base,Number(delta)*7);if(type==='agenda')agendaWeek=next;else choreWeek=next;render();return;}
  if(e.target.closest('[data-refresh-prices]')||e.target.closest('#priceRefreshBtn')){doRefreshPrices(true);return;}
  const ans=e.target.closest('[data-answer]')?.dataset.answer;if(ans){openQuestion(ans);return;}
  if(e.target.closest('[data-add-folder]')){openFolderForm();return;}
  if(e.target.closest('[data-add-trip-item]')){openForm('trips');return;}
  const sectionItem=e.target.closest('[data-add-trip-section-item]')?.dataset.addTripSectionItem;if(sectionItem){const section=store.data.tripSections.find(s=>s.id===sectionItem);openForm('trips',null,{tripFolderId:section?.tripFolderId||'',tripSectionId:sectionItem});return;}
  const addSection=e.target.closest('[data-add-section]')?.dataset.addSection;if(addSection){openSectionForm(addSection);return;}
  const delFolder=e.target.closest('[data-delete-folder]')?.dataset.deleteFolder;if(delFolder){if(await askConfirm('Reis verwijderen','De reis, mappen en onderdelen uit beta verwijderen?')){const sectionIds=store.data.tripSections.filter(s=>s.tripFolderId===delFolder).map(s=>s.id);store.data.trips=store.data.trips.filter(t=>!sectionIds.includes(t.tripSectionId));store.data.tripSections=store.data.tripSections.filter(s=>s.tripFolderId!==delFolder);store.data.tripFolders=store.data.tripFolders.filter(f=>f.id!==delFolder);store.save();}return;}
  const delSection=e.target.closest('[data-delete-section]')?.dataset.deleteSection;if(delSection){if(await askConfirm('Map verwijderen','De map en alle onderdelen uit beta verwijderen?')){store.data.trips=store.data.trips.filter(t=>t.tripSectionId!==delSection);store.data.tripSections=store.data.tripSections.filter(s=>s.id!==delSection);store.save();}return;}
  const editFolder=e.target.closest('[data-edit-folder]')?.dataset.editFolder;if(editFolder){openFolderForm(editFolder);return;}
  if(e.target.closest('[data-analyse-import]')){importState.text=document.querySelector('#importText')?.value||'';importState.preview=parseImportText(importState.text,importState.target).map(x=>({...x,selected:true}));render();toast(`${importState.preview.length} items gevonden`);return;}
  if(e.target.closest('[data-clear-import]')){importState={target:importState.target,text:'',preview:[],filename:''};render();return;}
  if(e.target.closest('[data-pick-import]')){document.querySelector('#importFileInput').click();return;}
  if(e.target.closest('[data-commit-import]')){document.querySelectorAll('[data-import-check]').forEach(ch=>{const i=Number(ch.dataset.importCheck);if(importState.preview[i])importState.preview[i].selected=ch.checked;});const selected=importState.preview.filter(x=>x.selected);const n=commitImported(store,selected);importState.preview=[];importState.text='';render();toast(`${n} items toegevoegd`);return;}
  const action=e.target.closest('[data-action]')?.dataset.action;if(action==='backup'){download(`samen-thuis-beta-${todayISO()}.json`,store.export());return;}if(action==='restore'){document.querySelector('#restoreInput').click();return;}
  if(e.target.closest('[data-import-production]')){document.querySelector('#productionBackupInput').click();return;}
  if(e.target.closest('[data-sync-now]')){doSync(false);return;}
  if(e.target.closest('[data-reset-beta]')){if(await askConfirm('Beta leegmaken','Alleen deze beta-app wordt leeggemaakt. Productie blijft onaangetast.')){store.reset();toast('Beta leeggemaakt');}return;}
});
document.addEventListener('change',e=>{
  if(e.target.id==='importTarget'){importState.target=e.target.value;importState.preview=[];render();}
  if(e.target.id==='autoStock'){store.data.settings.autoStockToGroceries=e.target.checked;store.save();stockToGroceries(store);}
  if(e.target.id==='autoPrice'){store.data.settings.autoPriceRefresh=e.target.checked;store.save();}
  if(e.target.id==='priceHours'){store.data.settings.priceRefreshHours=Number(e.target.value);store.save();}
});
document.querySelector('#itemForm').addEventListener('submit',saveForm);
document.querySelector('#questionForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.target),person=fd.get('person'),answer=String(fd.get('answer')||'').trim();if(!answer)return;store.data.dailyAnswers[todayISO()]||={};if(store.data.dailyAnswers[todayISO()][person])return;store.data.dailyAnswers[todayISO()][person]={answer,answeredAt:new Date().toISOString()};store.save();document.querySelector('#questionDialog').close();});
document.querySelector('#restoreInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadBackup(f,false);e.target.value='';});
document.querySelector('#productionBackupInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadBackup(f,true);e.target.value='';});
document.querySelector('#importFileInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{toast('Bestand wordt gelezen…');importState.filename=f.name;importState.text=await readImportFile(f);importState.preview=parseImportText(importState.text,importState.target).map(x=>({...x,selected:true}));render();toast(`${importState.preview.length} items gevonden`);}catch(err){console.error(err);toast(err.message);}e.target.value='';});
document.addEventListener('submit',async e=>{if(e.target.id!=='syncForm')return;e.preventDefault();const fd=new FormData(e.target);store.data.settings.supabaseUrl=String(fd.get('supabaseUrl')||'').trim();store.data.settings.supabaseAnonKey=String(fd.get('supabaseAnonKey')||'').trim();store.data.settings.householdCode=String(fd.get('householdCode')||'');store.save();await doSync(false);});

function openFolderForm(folderId=null){
  const existing=folderId?store.data.tripFolders.find(f=>f.id===folderId):null; const name=prompt('Naam van de reis',existing?.name||''); if(!name)return; const start=prompt('Startdatum (YYYY-MM-DD, optioneel)',existing?.startDate||'')||''; const end=prompt('Einddatum (YYYY-MM-DD, optioneel)',existing?.endDate||'')||''; if(existing){existing.name=name;existing.startDate=start;existing.endDate=end;}else{const f={id:id('tf'),name,startDate:start,endDate:end,note:''};store.data.tripFolders.push(f);store.data.tripSections.push({id:id('ts'),tripFolderId:f.id,name:'Algemeen'});}store.save();
}
function openSectionForm(folderId){ const name=prompt('Naam van de map',''); if(!name)return;store.data.tripSections.push({id:id('ts'),tripFolderId:folderId,name});store.save(); }

// Netwerk/PWA
function networkState(){document.querySelector('#offlineBanner').hidden=navigator.onLine;}window.addEventListener('online',()=>{networkState();doSync(true);autoPriceRefresh();});window.addEventListener('offline',networkState);networkState();
if('serviceWorker'in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.error));

stockToGroceries(store);
async function autoPriceRefresh(){ if(store.data.settings.autoPriceRefresh&&navigator.onLine){try{await refreshPriceTracks(store,{force:false});}catch(err){console.info('Automatische prijscheck overgeslagen:',err.message);}} }
setTimeout(autoPriceRefresh,1200);
setTimeout(()=>doSync(true),1800);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){autoPriceRefresh();doSync(true);}});

document.addEventListener('submit',e=>{if(e.target.id!=='sourceSettingsForm')return;e.preventDefault();const f=new FormData(e.target);store.data.settings.weatherLat=String(f.get('weatherLat')||'').trim();store.data.settings.weatherLon=String(f.get('weatherLon')||'').trim();store.data.settings.vehiclePlate=String(f.get('vehiclePlate')||'').trim().toUpperCase();store.data.settings.openDataQuery=String(f.get('openDataQuery')||'energie').trim();store.save();toast('Broninstellingen bewaard');});

document.addEventListener('submit',e=>{
 if(e.target.id==='carForm'){e.preventDefault();const f=new FormData(e.target),id=String(f.get('id')||'')||crypto.randomUUID();const old=carById(id)||{};const c={...old,id,nickname:String(f.get('nickname')||''),plate:String(f.get('plate')||'').toUpperCase(),brand:String(f.get('brand')||''),model:String(f.get('model')||''),fuelType:String(f.get('fuelType')||''),tankCapacity:Number(f.get('tankCapacity')||0)};store.data.cars=store.data.cars||[];const i=store.data.cars.findIndex(x=>x.id===id);if(i>=0)store.data.cars[i]=c;else store.data.cars.push(c);store.save();closeModal();toast('Auto opgeslagen');}
 if(e.target.id==='fuelForm'){e.preventDefault();const f=new FormData(e.target),liters=Number(f.get('liters')||0);let total=Number(f.get('total')||0),ppl=Number(f.get('pricePerLiter')||0);if(!total&&ppl)total=liters*ppl;if(!ppl&&total&&liters)ppl=total/liters;if(!total||!ppl){toast('Vul totaalbedrag of literprijs in');return;}store.data.fuelEntries=store.data.fuelEntries||[];store.data.fuelEntries.push({id:crypto.randomUUID(),carId:String(f.get('carId')),date:String(f.get('date')),odometer:Number(f.get('odometer')||0),liters,total,pricePerLiter:ppl,station:String(f.get('station')||''),fullTank:f.get('fullTank')==='on'});store.save();closeModal();toast('Tankbeurt opgeslagen');}
});
