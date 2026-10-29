export const pad = n => String(n).padStart(2,'0');
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
export const parseDate = value => value ? new Date(`${value}T12:00:00`) : null;
export const addDays = (value, days) => {
  const d = typeof value === 'string' ? parseDate(value) : new Date(value);
  d.setDate(d.getDate()+days);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
export const startOfWeek = value => {
  const d = typeof value === 'string' ? parseDate(value) : new Date(value);
  d.setDate(d.getDate()-((d.getDay()+6)%7));
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
export const weekDates = start => Array.from({length:7},(_,i)=>addDays(start,i));
export const id = (prefix='i') => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
export const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
export const fmtDate = (value, options={weekday:'short',day:'numeric',month:'short'}) => value ? new Intl.DateTimeFormat('nl-NL',options).format(parseDate(value)) : 'Geen datum';
export const norm = (value='') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const number = (value, fallback=0) => {
  const n = Number(String(value ?? '').replace(',','.'));
  return Number.isFinite(n) ? n : fallback;
};
export const money = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(value)) : '—';
export const groupBy = (items,keyFn) => items.reduce((a,x)=>{ const k=keyFn(x); (a[k] ||= []).push(x); return a; },{});
export const deepClone = v => structuredClone(v);
export const debounce = (fn,ms=300) => { let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args),ms); }; };
export const percentile = (values,p) => {
  const arr = values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!arr.length) return null;
  const idx=(arr.length-1)*p;
  const lo=Math.floor(idx), hi=Math.ceil(idx);
  return lo===hi ? arr[lo] : arr[lo]+(arr[hi]-arr[lo])*(idx-lo);
};
export const uniqueNumbers = values => [...new Set(values.map(v=>Number(v).toFixed(2)))].map(Number);
export const csvSplit = line => {
  const out=[]; let cur=''; let quote=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"') { if(quote && line[i+1]==='"'){cur+='"';i++;} else quote=!quote; }
    else if(c===',' && !quote){ out.push(cur.trim()); cur=''; }
    else cur+=c;
  }
  out.push(cur.trim()); return out;
};
export const toast = message => {
  const el=document.querySelector('#toast'); if(!el) return;
  el.textContent=message; el.classList.add('show');
  clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>el.classList.remove('show'),2300);
};
export const humanAge = iso => {
  if(!iso) return '';
  const ms=Date.now()-new Date(iso).getTime();
  const h=Math.max(0,Math.floor(ms/3600000));
  if(h<1) return 'zojuist'; if(h<24) return `${h}u geleden`;
  const d=Math.floor(h/24); return `${d}d geleden`;
};
