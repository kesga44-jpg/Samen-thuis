import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { guard, createRateLimiter, cleanText } from "../_shared/guard.ts";
import "../_shared/price-history-core.js";

const priceHistoryCore = (globalThis as typeof globalThis & {
  SamenThuisPriceHistory: {
    normalizeProviderProduct(product: unknown, response: unknown): Record<string, unknown>;
  };
}).SamenThuisPriceHistory;

// R7/PR-8: geen open CORS meer en een gebruikers-JWT is verplicht (zie ../_shared/guard.ts).
// CORS-headers worden per verzoek toegevoegd door withHeaders().
const limiter = createRateLimiter(30, 60_000);
const env = {
  url: Deno.env.get("SUPABASE_URL") || "",
  apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
  allowedOrigins: Deno.env.get("ALLOWED_ORIGINS") || ""
};
function withHeaders(res: Response, headers: Record<string,string>) {
  const merged = new Headers(res.headers);
  Object.entries(headers).forEach(([k, v]) => merged.set(k, v));
  return new Response(res.body, { status: res.status, headers: merged });
}
// Provider access is server-side; an API key is optional and must be stored as a Supabase secret.
const API = "https://www.prijsprofeet.nl/api/v1/search";
const CATEGORIES_API = "https://www.prijsprofeet.nl/api/v1/categories";
const PAGE_SIZE = 20;
const key = Deno.env.get("PRIJS_PROFEET_API_KEY") || "";

function json(body: unknown, status=200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function discountPercentage(price: unknown, originalPrice: unknown, reported: unknown) {
  const explicit = numberOrNull(reported);
  if (explicit != null && explicit > 0 && explicit <= 100) return explicit;
  const current = numberOrNull(price);
  const original = numberOrNull(originalPrice);
  if (current == null || original == null || original <= 0 || original <= current) return null;
  return ((original - current) / original) * 100;
}

function rank(results: any[], preferredRetailer: string, searchResponse: unknown) {
  const active = results.filter(x => x?.promotion_status === "active" && numberOrNull(x?.price) != null && Number(x.price) >= 0);
  if (!active.length) return null;
  const preferred = String(preferredRetailer || "").trim().toLowerCase();
  const pool = preferred ? active.filter(x => String(x.retailer || "").toLowerCase() === preferred) : active;
  const list = pool.length ? pool : active;
  // De API geeft fuzzy zoekresultaten in relevantievolgorde. Behoud die volgorde.
  const x = list[0];
  return {
    ...priceHistoryCore.normalizeProviderProduct(x, searchResponse),
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
  const price = numberOrNull(x.price);
  const originalPrice = numberOrNull(x.original_price);
  return {
    productId: x.product_id || x.base_product_id || "",
    ean: x.ean || "",
    name: x.name || "",
    brand: x.brand || x.brand_name || "",
    size: x.size || x.quantity || "",
    store: x.retailer || "",
    price,
    originalPrice,
    discountPercent: discountPercentage(price, originalPrice, x.savings_percentage),
    promotionText: x.promotion_text || x.offer_text || "",
    promotionType: x.promotion_type || "",
    validFrom: x.valid_from || "",
    validTo: x.valid_until || "",
    category: x.unified_category || x.category || "",
    unifiedCategory: x.unified_category || "",
    quantity: x.quantity ?? "",
    unit: x.unit || "",
    currency: x.currency || "",
    savingsAmount: numberOrNull(x.savings_amount),
    promotionStatus: x.promotion_status || "",
    promotionalKeywords: Array.isArray(x.promotional_keywords) ? x.promotional_keywords : [],
    multiBuyQuantity: numberOrNull(x.multi_buy_quantity),
    multiBuyPrice: numberOrNull(x.multi_buy_price),
    promoGroupId: x.promo_group_id ?? null,
    promoGroupMixable: x.promo_group_mixable ?? null,
    validUntilEstimated: x.valid_until_estimated === true,
    extractedAt: x.extracted_at || "",
    inStoreOnly: x.in_store_only === true,
    onlineOnly: x.online_only === true,
    loyaltyPrice: numberOrNull(x.loyalty_price),
    loyaltyProgram: x.loyalty_program || "",
    maxPerCustomer: numberOrNull(x.max_per_customer),
    imageUrl: x.image_url || "",
    unitPrice: x.unit_price != null ? String(x.unit_price) : "",
    unitPriceValue: numberOrNull(x.unit_price),
    unitPriceUnit: typeof x.unit === "string" ? x.unit.trim() : "",
    sourceUrl: x.url || x.product_url || x.offer_url || x.source_url || "",
    providerData: x,
    source: "PrijsProfeet"
  };
}

async function listCategories() {
  const headers: Record<string,string> = { "User-Agent": "SamenThuis/1.0 (+https://github.com/)", "Accept": "application/json" };
  if (key) headers["X-API-Key"] = key;
  try {
    const response = await fetchProvider(CATEGORIES_API, headers);
    if (!response.ok) {
      console.error("PrijsProfeet categories HTTP", response.status);
      return json({error:`PrijsProfeet ${response.status}`}, response.status >= 500 || response.status === 429 ? 502 : response.status);
    }
    let payload: any;
    try { payload = await response.json(); }
    catch (_) { console.error("PrijsProfeet categories: geen geldige JSON"); return json({error:"PrijsProfeet gaf geen geldige JSON terug"},502); }
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.categories) ? payload.categories : null;
    if (!list) { console.error("PrijsProfeet categories: onverwachte structuur"); return json({error:"Onverwachte categorie-response"},502); }
    const categories = list
      .filter((c: any) => c && typeof c.slug === "string" && c.slug)
      .map((c: any) => ({ slug: c.slug, name: c.name || c.slug, count: numberOrNull(c.count), group: c.group || "" }));
    if (!categories.length) { console.error("PrijsProfeet categories: lege lijst"); return json({error:"Geen categorieën ontvangen"},502); }
    return json({categories,source:"PrijsProfeet",checkedAt:new Date().toISOString()});
  } catch (error) {
    console.error("PrijsProfeet categories mislukt:", error instanceof Error ? error.name + ": " + error.message : "onbekend");
    return json({error:"Categorieën ophalen mislukt"},502);
  }
}

async function fetchProvider(url: string | URL, headers: Record<string,string>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try { return await fetch(url, { headers, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function searchOffers(query: string, category = "", page = 1) {
  const url = new URL(API);
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", String(PAGE_SIZE));
  url.searchParams.set("promotion_status", "active");
  if (category) url.searchParams.set("category", category);
  if (page > 1) url.searchParams.set("page", String(page));
  const headers: Record<string,string> = {
    "User-Agent": "SamenThuis/1.0 (+https://github.com/)"
  };
  if (key) headers["X-API-Key"] = key;
  const response = await fetchProvider(url, headers);
  if (!response.ok) return json({error:response.status===429?"PrijsProfeet heeft de aanvraaglimiet bereikt. Probeer later opnieuw.":`PrijsProfeet ${response.status}`},response.status);
  const payload = await response.json();
  const results = Array.isArray(payload.results) ? payload.results : [];
  const offers = results
    .filter((x: any) => x?.promotion_status === "active" && numberOrNull(x.price) != null && Number(x.price) >= 0 && String(x?.name || "").trim())
    .map(normalizeOffer);
  return json({offers,page,hasMore:results.length>=PAGE_SIZE,source:"PrijsProfeet",checkedAt:new Date().toISOString()});
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
  const response = await fetchProvider(url, headers);
  if (!response.ok) return { id:item.id, result:null, error:response.status===429?"PrijsProfeet heeft de aanvraaglimiet bereikt. Probeer later opnieuw.":`PrijsProfeet ${response.status}` };
  const payload = await response.json();
  return {
    id:item.id,
    result:rank(Array.isArray(payload.results) ? payload.results : [], item.preferredRetailer || "", payload),
    error:""
  };
}

serve(async req => {
  const gate = await guard(req, { env, limiter });
  if ("response" in gate) return gate.response;
  return withHeaders(await handle(gate.body), gate.headers);
});

async function handle(body: any): Promise<Response> {
  try {
    if (body?.categories === true) return await listCategories();
    if (body?.search != null) {
      const query = cleanText(body.search, 100);
      if (!query) return json({error:"Vul een productnaam of merk in"},400);
      const category = String(body.category || "").trim().slice(0, 60);
      if (category && !/^[a-z0-9-]+$/.test(category)) return json({error:"Ongeldige categorie"},400);
      const page = Math.min(20, Math.max(1, Math.floor(Number(body.page)) || 1));
      return await searchOffers(query, category, page);
    }
    const queries = (Array.isArray(body?.queries) ? body.queries.slice(0,25) : [])
      .filter((q: any) => q && typeof q === "object")
      .map((q: any) => ({ id: cleanText(q.id, 80), query: cleanText(q.query, 100), preferredRetailer: cleanText(q.preferredRetailer, 40) }));
    if (!queries.length) return json({results:[]});
    const results=[];
    // Kleine batches beperken de druk op de publieke API.
    for(let i=0;i<queries.length;i+=5){
      const batch=queries.slice(i,i+5);
      results.push(...await Promise.all(batch.map(lookup)));
    }
    return json({results,source:"PrijsProfeet",checkedAt:new Date().toISOString()});
  } catch (error) {
    console.error("grocery-prices mislukt:", error instanceof Error ? error.name : "onbekend");
    return json({error:"Aanbiedingen ophalen mislukt"},500);
  }
}
