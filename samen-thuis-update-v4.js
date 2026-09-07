
(() => {
'use strict';
const U={target:'planning',preview:[],text:'',filename:'',stateKey:null,state:null,
aliases:{
 planning:['planning','agenda','events','afspraken'],
 weekmenu:['weekmenu','menu','meals'],
 groceries:['boodschappen','groceries','shopping'],
 household:['huishouden','household','chores','tasks'],
 inventory:['voorraad','inventory','stock'],
 ideas:['ideeen','ideas','samenDoen'],
 home:['woning','home','projects'],
 travel:['reizen','travel','trips']
}};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const uid=()=>`imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
function toast(t){alert(t)}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]/g,'')}
function discover(){
 let best=null;
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);
  try{
   const obj=JSON.parse(localStorage.getItem(key)); if(!obj||typeof obj!=='object'||Array.isArray(obj))continue;
   const txt=norm(Object.keys(obj).join(' '));
   const score=['planning','agenda','weekmenu','boodschappen','huishouden','voorraad','reizen','travel','inventory','tasks'].filter(x=>txt.includes(norm(x))).length;
   if(score && (!best||score>best.score))best={key,obj,score};
  }catch{}
 }
 if(best){U.stateKey=best.key;U.state=best.obj;return true}
 return false;
}
function save(){if(!U.stateKey||!U.state)return false;localStorage.setItem(U.stateKey,JSON.stringify(U.state));return true}
function findArray(target){
 if(!U.state&&!discover())return null;
 const aliases=U.aliases[target].map(norm); let best=null;
 function walk(o,path=[],d=0){
  if(!o||typeof o!=='object'||d>4)return;
  for(const [k,v] of Object.entries(o)){
   const kn=norm(k);
   if(Array.isArray(v)){
    let s=0;for(const a of aliases){if(kn===a)s+=100;else if(kn.includes(a)||a.includes(kn))s+=25}
    if(s&&(!best||s>best.score))best={arr:v,path:[...path,k],score:s};
   } else if(v&&typeof v==='object') walk(v,[...path,k],d+1);
  }
 }
 walk(U.state);return best;
}
function findById(id){
 let found=null;
 function walk(x,d=0){
  if(found||!x||typeof x!=='object'||d>7)return;
  if(!Array.isArray(x)&&['id','uuid','key'].some(k=>String(x[k]??'')===String(id))){found=x;return}
  if(Array.isArray(x))x.forEach(v=>walk(v,d+1));else Object.values(x).forEach(v=>walk(v,d+1));
 }
 walk(U.state);return found;
}
function modalEdit(obj,onDone){
 const fields=Object.entries(obj).filter(([k,v])=>!['id','uuid','key','createdAt','updatedAt'].includes(k)&&(v===null||['string','number','boolean'].includes(typeof v)));
 if(!fields.length)return toast('Geen bewerkbare velden gevonden.');
 const body=fields.map(([k,v])=>`<label style="display:grid;gap:4px;margin:10px 0"><span>${esc(k)}</span>${String(v??'').length>70?`<textarea data-f="${esc(k)}" style="min-height:70px">${esc(v??'')}</textarea>`:`<input data-f="${esc(k)}" value="${esc(v??'')}">`}</label>`).join('');
 const wrap=document.createElement('div');wrap.style='position:fixed;inset:0;background:#0006;z-index:99999;padding:20px;overflow:auto';
 wrap.innerHTML=`<div style="max-width:650px;margin:5vh auto;background:white;padding:20px;border-radius:16px;font-family:-apple-system"><h2>Bewerken</h2>${body}<div style="display:flex;gap:8px;justify-content:flex-end"><button data-c>Annuleren</button><button data-s>Opslaan</button></div></div>`;
 document.body.appendChild(wrap);
 wrap.querySelector('[data-c]').onclick=()=>wrap.remove();
 wrap.querySelector('[data-s]').onclick=()=>{
  wrap.querySelectorAll('[data-f]').forEach(el=>{const k=el.dataset.f,old=obj[k];let v=el.value;if(typeof old==='number')v=Number(v)||0;if(typeof old==='boolean')v=v==='true'||v==='1';obj[k]=v});
  onDone();wrap.remove();
 };
}
function enhanceEdits(){
 if(!U.state)discover();
 $$('button').forEach(btn=>{
  if(btn.dataset.stDone)return;
  const attr=[...btn.attributes].find(a=>/data-(delete|remove|trash|del)/i.test(a.name)&&a.value);
  let id=attr?.value||btn.closest('[data-id],[data-item-id]')?.dataset.id||btn.closest('[data-item-id]')?.dataset.itemId||'';
  const isDelete=!!attr||(btn.textContent||'').trim()==='×'||/verwijder/i.test(btn.textContent||'');
  if(!isDelete||!id)return;
  const host=btn.parentElement;if(host?.querySelector('[data-st-edit]'))return;
  const e=document.createElement('button');e.type='button';e.textContent='✎';e.title='Bewerken';e.dataset.stEdit=id;e.style='margin-right:6px';
  btn.before(e);btn.dataset.stDone='1';
 });
}
function parseDate(s){
 let m=String(s).match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
 m=String(s).match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);if(m)return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;return '';
}
function sample(t){return findArray(t)?.arr?.find(x=>x&&typeof x==='object')||null}
function make(sample,vals){
 const o={};if(sample)for(const [k,v] of Object.entries(sample)){if(k==='id')o[k]=uid();else if(Array.isArray(v))o[k]=[];else if(v&&typeof v==='object')o[k]={};else if(typeof v==='boolean')o[k]=false;else if(typeof v==='number')o[k]=0;else o[k]=''}
 if(!o.id)o.id=uid();return Object.assign(o,vals);
}
function parse(text,t){
 const s=sample(t),ls=String(text||'').replace(/\r/g,'').split(/\n+/).map(x=>x.trim()).filter(Boolean).filter(x=>!/^#\s*(pagina|werkblad)/i.test(x));
 if(t==='planning')return ls.filter(x=>parseDate(x)).map(x=>{const d=parseDate(x),title=x.replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/]\d{1,2}[-/]20\d{2}\b/,'').replace(/^[\s,;:\-–]+/,'').trim();return{selected:true,data:make(s,{date:d,title,name:title,text:title})}});
 if(t==='groceries')return ls.map(x=>{const n=x.replace(/^[✓✔☐□\-•*\d.)\s]+/,'').trim();return{selected:true,data:make(s,{name:n,title:n,text:n,checked:false,done:false,completed:false})}});
 if(t==='household')return ls.map(x=>{const p=x.split(/\s+[—–-]\s+|;|\|/);return{selected:true,data:make(s,{name:p[0],title:p[0],task:p[0],frequency:p[1]||'',owner:'Samen',done:false,completed:false})}});
 if(t==='inventory')return ls.map(x=>{const m=x.match(/^(.+?)(?:\s+(\d+(?:[.,]\d+)?)\s*([A-Za-z]+)?)?$/),n=(m?.[1]||x).trim(),q=m?.[2]?Number(m[2].replace(',','.')):1;return{selected:true,data:make(s,{name:n,title:n,quantity:q,amount:q,unit:m?.[3]||''})}});
 if(t==='travel')return String(text).split(/\n\s*\n+/).map(x=>x.trim()).filter(Boolean).map(x=>{const first=x.split('\n')[0];return{selected:true,data:make(s,{name:first,title:first,text:x,notes:x,date:parseDate(x),done:false})}});
 if(t==='weekmenu')return ls.map(x=>{const p=x.split(/[:;|]/);return{selected:true,data:make(s,{day:p[0]||'',meal:p.slice(1).join(' ')||x,title:p.slice(1).join(' ')||x,name:p.slice(1).join(' ')||x})}});
 return ls.map(x=>{const n=x.replace(/^[\-•*]\s*/,'');return{selected:true,data:make(s,{name:n,title:n,text:n,done:false})}});
}
async function load(src){if([...document.scripts].some(s=>s.src.includes(src.split('/').pop())))return;await new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
async function readFile(f){
 const ext=f.name.toLowerCase().split('.').pop();
 if(['txt','md','csv'].includes(ext))return await f.text();
 if(ext==='docx'){await load('https://cdn.jsdelivr.net/npm/mammoth@1.12.2/mammoth.browser.min.js');return (await mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()})).value||''}
 if(['xlsx','xlsm','xls'].includes(ext)){await load('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});return wb.SheetNames.map(n=>XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n')}
 if(ext==='pdf'){await load('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;let text='';for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),tc=await p.getTextContent();text+=tc.items.map(x=>x.str).join(' ')+'\n'}return text}
 throw new Error('Bestandstype niet ondersteund');
}
function renderPreview(){
 const box=$('#st-prev');if(!box)return;box.innerHTML=U.preview.length?U.preview.map((x,i)=>`<div style="border:1px solid #ddd;border-radius:12px;padding:10px;margin:8px 0"><label><input type="checkbox" data-pc="${i}" ${x.selected?'checked':''}> <strong>${esc(x.data.title||x.data.name||x.data.task||x.data.text||'Item')}</strong></label><button data-pe="${i}" style="float:right">✎</button></div>`).join(''):'<p>Nog niets geanalyseerd.</p>';
}
function openImport(){
 let p=$('#st-import');if(!p){p=document.createElement('div');p.id='st-import';document.body.appendChild(p)}
 p.style='position:fixed;inset:0;background:#f4f4f2;z-index:99990;overflow:auto;padding:20px;font-family:-apple-system';
 p.innerHTML=`<div style="max-width:950px;margin:auto"><div style="display:flex;justify-content:space-between"><h1>Importeren</h1><button data-close>Sluiten</button></div><div style="background:white;padding:16px;border-radius:16px"><label>Waar hoort dit bij?<select id="st-target"><option value="planning">Planning / Agenda</option><option value="weekmenu">Weekmenu</option><option value="groceries">Boodschappen</option><option value="household">Huishouden</option><option value="inventory">Voorraad</option><option value="ideas">Samen doen / Ideeën</option><option value="home">Woning</option><option value="travel">Reizen</option></select></label><textarea id="st-text" style="width:100%;min-height:150px;margin:12px 0" placeholder="Plak hier tekst...">${esc(U.text)}</textarea><div><button data-file>Bestand kiezen</button> <button data-an>Analyseren</button> <button data-commit>Geselecteerde toevoegen</button></div><input id="st-file" type="file" hidden accept=".pdf,.docx,.xlsx,.xlsm,.xls,.txt,.md,.csv"><div id="st-prev" style="margin-top:16px"></div></div></div>`;
 $('#st-target').value=U.target;$('#st-target').onchange=e=>{U.target=e.target.value;U.preview=parse(U.text,U.target);renderPreview()};renderPreview();
 $('#st-file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{U.filename=f.name;U.text=await readFile(f);$('#st-text').value=U.text;U.preview=parse(U.text,U.target);renderPreview()}catch(err){toast(err.message)}e.target.value=''};
}
function addNav(){
 if($('#st-import-nav'))return;const b=document.createElement('button');b.id='st-import-nav';b.type='button';b.textContent='↥ Importeren';b.style='position:fixed;right:16px;bottom:76px;z-index:9990;border:0;background:#163f2f;color:white;border-radius:999px;padding:11px 14px;box-shadow:0 8px 24px #0002';document.body.appendChild(b);b.onclick=openImport;
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.stEdit){const o=findById(b.dataset.stEdit);if(!o)return toast('Item niet gevonden');return modalEdit(o,()=>{save();location.reload()})}
 if(b.hasAttribute('data-close'))return $('#st-import').remove();
 if(b.hasAttribute('data-file'))return $('#st-file').click();
 if(b.hasAttribute('data-an')){U.text=$('#st-text').value;U.preview=parse(U.text,U.target);return renderPreview()}
 if(b.dataset.pe!==undefined)return modalEdit(U.preview[Number(b.dataset.pe)].data,renderPreview);
 if(b.hasAttribute('data-commit')){if(!discover())return toast('Appgegevens niet gevonden');const hit=findArray(U.target);if(!hit)return toast('Gekozen tab niet gevonden in appdata');const items=U.preview.filter(x=>x.selected).map(x=>x.data);hit.arr.push(...items);save();toast(`${items.length} items toegevoegd`);setTimeout(()=>location.reload(),200)}
});
document.addEventListener('change',e=>{if(e.target.dataset.pc!==undefined)U.preview[Number(e.target.dataset.pc)].selected=e.target.checked});
function start(){discover();addNav();enhanceEdits();new MutationObserver(enhanceEdits).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
