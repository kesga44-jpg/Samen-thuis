// Open databronnen voor Samen Thuis β.
async function getJson(url,options={}){const r=await fetch(url,{...options,headers:{Accept:'application/json',...(options.headers||{})}});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.json();}
export async function weather(lat,lon){if(!lat||!lon)throw new Error('Vul coördinaten in bij Instellingen.');const u=new URL('https://api.open-meteo.com/v1/forecast');u.searchParams.set('latitude',lat);u.searchParams.set('longitude',lon);u.searchParams.set('current','temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m');u.searchParams.set('daily','temperature_2m_max,temperature_2m_min,precipitation_probability_max');u.searchParams.set('timezone','auto');u.searchParams.set('forecast_days','3');return getJson(u);}
export async function openFoodFacts(barcode){const c=String(barcode||'').replace(/\D/g,'');if(!c)throw new Error('Vul een barcode in.');return getJson(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(c)}?fields=code,product_name,brands,quantity,image_front_small_url,nutriscore_grade,nova_group,categories_tags`);}
export async function openPrices(barcode){const c=String(barcode||'').replace(/\D/g,'');if(!c)throw new Error('Vul een barcode in.');return getJson(`https://prices.openfoodfacts.org/api/v1/prices?product_code=${encodeURIComponent(c)}&page_size=20&order_by=-date`);}
export async function rdw(kenteken){const p=String(kenteken||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!p)throw new Error('Vul een kenteken in.');const rows=await getJson(`https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${encodeURIComponent(p)}&$limit=1`);return rows[0]||null;}
export async function cbsFuel(){
  const url="https://opendata.cbs.nl/ODataApi/OData/80416NED/TypedDataSet?$select=Perioden,BenzineEuro95_1,Diesel_2,Lpg_3";
  const data=await getJson(url);
  const rows=(data.value||[]).filter(x=>/^\d{8}$/.test(String(x.Perioden||"")));
  if(!rows.length)throw new Error("CBS: geen geldige dagprijzen ontvangen");
  rows.sort((a,b)=>String(b.Perioden).localeCompare(String(a.Perioden)));
  const x=rows[0];
  return {date:String(x.Perioden),petrol:Number(x.BenzineEuro95_1),diesel:Number(x.Diesel_2),lpg:Number(x.Lpg_3),source:"CBS StatLine 80416NED"};
}
export async function overheidSearch(query){const q=String(query||'').trim();if(!q)throw new Error('Vul een zoekterm in.');return getJson(`https://data.overheid.nl/data/api/3/action/package_search?q=${encodeURIComponent(q)}&rows=8`);}
export async function viaSupabase(data,action,payload={}){const base=String(data.settings.supabaseUrl||'').replace(/\/$/,'');if(!base)throw new Error('Supabase URL ontbreekt.');const h={'Content-Type':'application/json'};if(data.settings.supabaseAnonKey){h.apikey=data.settings.supabaseAnonKey;h.Authorization=`Bearer ${data.settings.supabaseAnonKey}`;}const r=await fetch(`${base}/functions/v1/data-sources`,{method:'POST',headers:h,body:JSON.stringify({action,...payload})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||`Bronservice ${r.status}`);return b;}
export async function nedEnergy(data){return viaSupabase(data,'ned-energy',{});}
export function extractOpenPrices(p){const r=p?.items||p?.results||p?.data||[];return Array.isArray(r)?r:[];}

export async function airQuality(lat,lon){
 if(!lat||!lon)throw new Error('Vul coördinaten in bij Instellingen.');
 const u=new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
 u.searchParams.set('latitude',lat);u.searchParams.set('longitude',lon);
 u.searchParams.set('current','european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen');
 u.searchParams.set('hourly','european_aqi,pm2_5,pm10,ozone,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen');
 u.searchParams.set('timezone','auto');u.searchParams.set('forecast_days','4');
 return getJson(u);
}

export async function euFuelSummary(){
  const r=await getJson("https://www.fuel-prices.eu/live/api.php?action=summary");
  return r?.data?.countries||[];
}
export async function geocodePlace(name,countryCode=""){
  const u=new URL("https://geocoding-api.open-meteo.com/v1/search");
  u.searchParams.set("name",name);u.searchParams.set("count","5");u.searchParams.set("language","nl");u.searchParams.set("format","json");
  const r=await getJson(u);
  const rows=r.results||[];
  return rows.find(x=>!countryCode||String(x.country_code||"").toUpperCase()===countryCode.toUpperCase())||rows[0]||null;
}
export async function germanFuelStations(data,{place="Emmerich am Rhein",fuel="e10",radius=25}={}){
  const geo=await geocodePlace(place,"DE");
  if(!geo)throw new Error("Duitse zoekplaats niet gevonden");
  return viaSupabase(data,"tankerkoenig",{lat:geo.latitude,lng:geo.longitude,radius,fuel,place});
}
