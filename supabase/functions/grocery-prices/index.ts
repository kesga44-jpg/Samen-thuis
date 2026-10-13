import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
// Provider access is server-side; an API key is optional and must be stored as a Supabase secret.
const API = "https://www.prijsprofeet.nl/api/v1/search";
const key = Deno.env.get("PRIJS_PROFEET_API_KEY") || "";

function json(body: unknown, status=200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function rank(results: any[], preferredRetailer: string) {
  const active = results.filter(x => x?.promotion_status === "active" && Number.isFinite(Number(x?.price)));
  if (!active.length) return null;
  const preferred = String(preferredRetailer || "").trim().toLowerCase();
  const pool = preferred ? active.filter(x => String(x.retailer || "").toLowerCase() === preferred) : active;
  const list = pool.length ? pool : active;
  // De API geeft fuzzy zoekresultaten in relevantievolgorde. Behoud die volgorde.
  const x = list[0];
  return {
    productId: x.product_id || x.base_product_id || "",
    baseProductId: x.base_product_id || "",
    name: x.name || "",
    retailer: x.retailer || "",
    price: Number(x.price),
    originalPrice: x.original_price == null ? null : Number(x.original_price),
    savingsPercentage: x.savings_percentage == null ? null : Number(x.savings_percentage),
    promotionType: x.promotion_type || "",
    promotionText: x.promotion_text || x.offer_text || "",
    promotionStatus: x.promotion_status || "active",
    validFrom: x.valid_from || "",
    validUntil: x.valid_until || "",
    unitPrice: x.unit_price || x.price_per_unit || "",
    category: x.category || "",
    ean: x.ean || ""
  };
}

function normalizeOffer(x: any) {
  return {
    productId: x.product_id || x.base_product_id || "",
    ean: x.ean || "",
    name: x.name || "",
    brand: x.brand || x.brand_name || "",
    size: x.size || x.quantity || "",
    store: x.retailer || "",
    price: Number(x.price),
    originalPrice: x.original_price == null ? null : Number(x.original_price),
    discountPercent: x.savings_percentage == null ? null : Number(x.savings_percentage),
    promotionText: x.promotion_text || x.offer_text || "",
    validFrom: x.valid_from || "",
    validTo: x.valid_until || "",
    category: x.category || "",
    sourceUrl: x.url || x.product_url || x.offer_url || x.source_url || "",
    source: "PrijsProfeet"
  };
}

async function searchOffers(query: string) {
  const url = new URL(API);
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", "20");
  url.searchParams.set("promotion_status", "active");
  const headers: Record<string,string> = {
    "User-Agent": "SamenThuis/1.0 (+https://github.com/)"
  };
  if (key) headers["X-API-Key"] = key;
  const response = await fetch(url, { headers });
  if (!response.ok) return json({error:`PrijsProfeet ${response.status}`},response.status);
  const payload = await response.json();
  const results = Array.isArray(payload.results) ? payload.results : [];
  const offers = results
    .filter((x: any) => x?.promotion_status === "active" && x?.price != null && Number.isFinite(Number(x.price)) && String(x?.name || "").trim())
    .map(normalizeOffer);
  return json({offers,source:"PrijsProfeet",checkedAt:new Date().toISOString()});
}

async function lookup(item: {id:string;query:string;preferredRetailer?:string}) {
  const query = String(item.query || "").trim();
  if (!query) return { id:item.id, result:null, error:"Lege zoekterm" };
  const url = new URL(API);
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", "20");
  url.searchParams.set("promotion_status", "active");
  const headers: Record<string,string> = {
    "User-Agent": "SamenThuisBeta/1.0 (+https://github.com/)"
  };
  if (key) headers["X-API-Key"] = key;
  const response = await fetch(url, { headers });
  if (!response.ok) return { id:item.id, result:null, error:`PrijsProfeet ${response.status}` };
  const payload = await response.json();
  return { id:item.id, result:rank(Array.isArray(payload.results) ? payload.results : [], item.preferredRetailer || ""), error:"" };
}

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers:cors });
  if (req.method !== "POST") return json({error:"Gebruik POST"},405);
  try {
    const body = await req.json();
    if (body?.search != null) {
      const query = String(body.search).trim().slice(0, 100);
      if (!query) return json({error:"Vul een productnaam of merk in"},400);
      return await searchOffers(query);
    }
    const queries = Array.isArray(body?.queries) ? body.queries.slice(0,25) : [];
    if (!queries.length) return json({results:[]});
    const results=[];
    // Kleine batches beperken de druk op de publieke API.
    for(let i=0;i<queries.length;i+=5){
      const batch=queries.slice(i,i+5);
      results.push(...await Promise.all(batch.map(lookup)));
    }
    return json({results,source:"PrijsProfeet",checkedAt:new Date().toISOString()});
  } catch (error) {
    console.error(error);
    return json({error:error instanceof Error?error.message:"Onbekende fout"},500);
  }
});
