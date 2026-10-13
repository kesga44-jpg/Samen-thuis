import {toast} from './utils.js';

const enc=new TextEncoder();
const dec=new TextDecoder();

function b64(bytes){ let s=''; bytes.forEach(b=>s+=String.fromCharCode(b)); return btoa(s); }
function unb64(text){ const s=atob(text); return Uint8Array.from(s,c=>c.charCodeAt(0)); }
async function sha256(text){ return new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(text))); }
async function householdId(code){ const bytes=await sha256(`samen-thuis-beta-v1|${code}`); return [...bytes.slice(0,16)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
async function keyFor(code){ const bytes=await sha256(`samen-thuis-beta-encryption-v1|${code}`); return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']); }
async function encryptData(data,code){
  const key=await keyFor(code), iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(data))));
  return {v:1,iv:b64(iv),data:b64(cipher)};
}
async function decryptData(payload,code){
  const key=await keyFor(code), iv=unb64(payload.iv), bytes=unb64(payload.data);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,bytes);
  return JSON.parse(dec.decode(plain));
}
function headers(settings){
  return {'Content-Type':'application/json','apikey':settings.supabaseAnonKey,'Authorization':`Bearer ${settings.supabaseAnonKey}`,'Prefer':'return=representation'};
}
function configured(settings){ return Boolean(settings.supabaseUrl&&settings.supabaseAnonKey&&String(settings.householdCode||'').length>=12); }

export async function syncNow(store,{quiet=false}={}){
  const settings=store.data.settings;
  if(!configured(settings)) { if(!quiet) toast('Vul eerst een huishoudcode van minimaal 12 tekens in'); return {status:'not-configured'}; }
  const base=settings.supabaseUrl.replace(/\/$/,''), rid=await householdId(settings.householdCode);
  const url=`${base}/rest/v1/household_data?id=eq.${encodeURIComponent(rid)}&select=id,payload,updated_at`;
  const read=await fetch(url,{headers:headers(settings)});
  if(!read.ok) throw new Error(`Sync lezen ${read.status}`);
  const rows=await read.json();
  const remote=rows[0];
  if(!remote){
    const payload=await encryptData(store.data,settings.householdCode);
    const create=await fetch(`${base}/rest/v1/household_data`,{method:'POST',headers:headers(settings),body:JSON.stringify({id:rid,payload})});
    if(!create.ok) throw new Error(`Sync maken ${create.status}`);
    settings.lastSyncedAt=new Date().toISOString(); store.save({touch:false});
    return {status:'pushed'};
  }
  let remoteData;
  try{ remoteData=await decryptData(remote.payload,settings.householdCode); }
  catch{ throw new Error('De huishoudcode past niet bij de beta-data in Supabase'); }
  const localTime=new Date(store.data.meta.updatedAt||0).getTime();
  const remoteTime=new Date(remoteData.meta?.updatedAt||remote.updated_at||0).getTime();
  if(remoteTime>localTime+1000){
    // Houd lokale verbindingsinstellingen vast; ze zijn apparaat-specifiek.
    const localSettings={...store.data.settings};
    store.data={...remoteData,settings:{...remoteData.settings,...localSettings,lastSyncedAt:new Date().toISOString()}};
    store.save({touch:false});
    return {status:'pulled'};
  }
  const payload=await encryptData(store.data,settings.householdCode);
  const write=await fetch(`${base}/rest/v1/household_data?id=eq.${encodeURIComponent(rid)}`,{method:'PATCH',headers:headers(settings),body:JSON.stringify({payload,updated_at:new Date().toISOString()})});
  if(!write.ok) throw new Error(`Sync schrijven ${write.status}`);
  settings.lastSyncedAt=new Date().toISOString(); store.save({touch:false});
  return {status:'pushed'};
}

export function syncConfigured(data){ return configured(data.settings); }
