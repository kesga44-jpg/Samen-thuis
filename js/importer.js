import {id,number,norm,todayISO} from './utils.js';

export const IMPORT_TARGETS={planning:'Agenda',meals:'Weekmenu',groceries:'Boodschappen',chores:'Huishouden',stock:'Voorraad',ideas:'Ideeën',home:'Woning',trips:'Reizen'};

const schemas={
  planning:['title','date','time','endTime','person','calendar','note'],
  meals:['date','type','title','persons','note'],
  groceries:['title','amount','unit','category','store','done','note'],
  chores:['title','category','frequency','person','nextDate','priority','notes'],
  stock:['title','category','amount','unit','min','desired','bestBefore','location','note'],
  ideas:['title','category','description','person','priority','status','date'],
  home:['title','category','description','priority','due','status','cost','done'],
  trips:['trip','section','title','type','description','startDate','endDate','deadline','location','cost','priority','checkable','done','note']
};
const aliases={agenda:'planning',planning:'planning',weekmenu:'meals',menu:'meals',boodschappen:'groceries',boodschap:'groceries',groceries:'groceries',huishouden:'chores',taak:'chores',taken:'chores',voorraad:'stock',stock:'stock',idee:'ideas',ideeen:'ideas',woning:'home',huis:'home',reizen:'trips',reis:'trips'};

function bool(v){ return /^(1|ja|yes|true|x|✓|afgevinkt|klaar)$/i.test(String(v||'').trim()); }
function clean(v=''){ return String(v).trim().replace(/^\[(.*)\]$/,'$1').trim(); }
function iso(v=''){
  const s=String(v).trim(); let m=s.match(/^(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/); if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  m=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})$/); if(m)return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  return s;
}
export function splitFlexible(line){
  const s=String(line).trim();
  if(s.includes('|')) return s.split('|').map(clean);
  if(s.includes(';')) return s.split(';').map(clean);
  if(s.includes('\t')) return s.split(/\t+/).map(clean);
  if(/\s\/\s/.test(s)) return s.split(/\s+\/\s+/).map(clean);
  if(/\s[-–—]\s/.test(s)) return s.split(/\s+[-–—]\s+/).map(clean);
  return [clean(s)];
}
function inferTarget(parts,fallback){ const key=norm(parts[0]).replace(/\s/g,''); return aliases[key]||fallback; }

function buildSimple(target,values){
  const s=schemas[target]; const obj={}; s.forEach((k,i)=>obj[k]=values[i]??'');
  if(target==='planning') return {id:id('p'),title:obj.title||'Afspraak',date:iso(obj.date),time:obj.time,endTime:obj.endTime,person:obj.person||'Samen',calendar:obj.calendar||'Persoonlijk',note:obj.note||''};
  if(target==='meals') return {id:id('m'),date:iso(obj.date),type:obj.type||'Avondeten',title:obj.title||'Maaltijd',persons:obj.persons||'',note:obj.note||''};
  if(target==='groceries') return {id:id('g'),title:obj.title||'Product',amount:number(obj.amount,1),unit:obj.unit||'',category:obj.category||'Overig',store:obj.store||'',done:bool(obj.done),note:obj.note||'',source:'import',priceTrackId:''};
  if(target==='chores') return {id:id('c'),title:obj.title||'Taak',category:obj.category||'',frequency:obj.frequency||'Wekelijks',person:obj.person||'Samen',nextDate:iso(obj.nextDate)||todayISO(),priority:obj.priority||'Normaal',notes:obj.notes||'',completedDates:[]};
  if(target==='stock') return {id:id('s'),title:obj.title||'Product',category:obj.category||'Overig',amount:number(obj.amount,0),unit:obj.unit||'stuks',min:number(obj.min,0),desired:number(obj.desired,number(obj.min,0)),bestBefore:iso(obj.bestBefore),location:obj.location||'',note:obj.note||'',priceTrackId:''};
  if(target==='ideas') return {id:id('i'),title:obj.title||'Idee',category:obj.category||'Thuis',description:obj.description||'',person:obj.person||'',priority:obj.priority||'',status:obj.status||'',date:iso(obj.date)};
  if(target==='home') return {id:id('h'),title:obj.title||'Woningitem',category:obj.category||'Onderhoud',description:obj.description||'',priority:obj.priority||'',due:iso(obj.due),status:obj.status||'',cost:number(obj.cost,0),done:bool(obj.done)};
  if(target==='trips') return {id:id('t'),trip:obj.trip||'Nieuwe reis',section:obj.section||'Algemeen',title:obj.title||'Reisitem',type:obj.type||'Notitie',description:obj.description||'',startDate:iso(obj.startDate),endDate:iso(obj.endDate),deadline:iso(obj.deadline),location:obj.location||'',cost:number(obj.cost,0),priority:obj.priority||'',checkable:bool(obj.checkable),done:bool(obj.done),note:obj.note||''};
}

export function parseImportText(text,target){
  const raw=String(text||'').trim(); if(!raw)return [];
  if(/^[\[{]/.test(raw)){
    try{
      const json=JSON.parse(raw); const arr=Array.isArray(json)?json:(json[target]||json.items||[]);
      if(Array.isArray(arr)) return arr.map(x=>({target,item:{id:x.id||id(target.slice(0,1)),...x}}));
    }catch{}
  }
  return raw.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')).map(line=>{
    let parts=splitFlexible(line); const detected=inferTarget(parts,target);
    const explicit=aliases[norm(parts[0]).replace(/\s/g,'')]; if(explicit) parts=parts.slice(1);
    return {target:detected,item:buildSimple(detected,parts),source:line};
  }).filter(x=>x.item?.title||x.target==='meals');
}

export function commitImported(store,entries){
  let count=0;
  for(const entry of entries){
    const {target,item}=entry;
    if(target==='trips'){
      let folder=store.data.tripFolders.find(x=>norm(x.name)===norm(item.trip));
      if(!folder){ folder={id:id('tf'),name:item.trip,startDate:item.startDate||'',endDate:item.endDate||'',note:'Via import'}; store.data.tripFolders.push(folder); }
      let section=store.data.tripSections.find(x=>x.tripFolderId===folder.id&&norm(x.name)===norm(item.section));
      if(!section){ section={id:id('ts'),tripFolderId:folder.id,name:item.section}; store.data.tripSections.push(section); }
      store.data.trips.push({id:item.id,tripFolderId:folder.id,tripSectionId:section.id,title:item.title,date:item.deadline||item.startDate||'',startDate:item.startDate||'',endDate:item.endDate||'',type:item.type,description:item.description,location:item.location,cost:item.cost,priority:item.priority,checkable:item.checkable,done:item.done,note:item.note});
    } else {
      if(target==='stock'){ const track=store.ensureTrack(item.title,item.title); item.priceTrackId=track.id; }
      if(target==='groceries'){ const stock=store.data.stock.find(s=>norm(s.title)===norm(item.title)); if(stock?.priceTrackId)item.priceTrackId=stock.priceTrackId; }
      store.data[target].push(item);
    }
    count++;
  }
  store.data.importHistory.unshift({id:id('imp'),at:new Date().toISOString(),count}); store.data.importHistory=store.data.importHistory.slice(0,25);
  store.save(); return count;
}

async function loadScript(src,test){ if(test())return; await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);}); }
export async function readImportFile(file){
  const ext=file.name.toLowerCase().split('.').pop();
  if(['txt','md','csv','json'].includes(ext)) return file.text();
  if(ext==='docx'){
    await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.9.1/mammoth.browser.min.js',()=>Boolean(window.mammoth));
    return (await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value||'';
  }
  if(['xlsx','xls','xlsm'].includes(ext)){
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',()=>Boolean(window.XLSX));
    const wb=window.XLSX.read(await file.arrayBuffer(),{type:'array'});
    return wb.SheetNames.map(n=>window.XLSX.utils.sheet_to_csv(wb.Sheets[n],{FS:'|'})).join('\n');
  }
  if(ext==='pdf'){
    const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise; const chunks=[];
    for(let i=1;i<=pdf.numPages;i++){ const page=await pdf.getPage(i); const content=await page.getTextContent(); chunks.push(content.items.map(x=>x.str).join(' ')); }
    return chunks.join('\n');
  }
  throw new Error('Dit bestandstype wordt niet ondersteund');
}
