// Gedeelde beveiliging voor Samen Thuis Edge Functions (risico R7, roadmap PR-8).
// - JWT van een echte gebruiker verplicht (publishable key alleen is niet genoeg);
// - CORS alleen voor toegestane origins (secret ALLOWED_ORIGINS, komma-gescheiden);
// - groottelimiet op het verzoek en best-effort limiet per gebruiker.
// Alleen standaard Web-API's, zodat dit bestand ook in Node-tests te importeren is.

export const DEFAULT_ALLOWED_ORIGINS = ["https://kesga44-jpg.github.io"];
export const MAX_BODY_BYTES = 8 * 1024;

export function parseAllowedOrigins(value: string | undefined | null): string[] {
  const list = String(value || "")
    .split(",")
    .map((x) => x.trim().replace(/\/+$/, ""))
    .filter((x) => /^https?:\/\/[^\s/]+$/.test(x));
  return list.length ? list : DEFAULT_ALLOWED_ORIGINS;
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function bearerToken(req: Request): string {
  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : "";
}

// Een gebruikers-JWT bestaat uit drie base64url-delen. Publishable/anon keys en lege waarden vallen hierbuiten.
export function looksLikeJwt(token: string): boolean {
  return /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/.test(token);
}

export type UserCheck = { ok: true; userId: string } | { ok: false; status: number; error: string };

// Controleert de token bij Supabase Auth (GET /auth/v1/user). Zonder geldige sessie: 401.
export async function requireUser(
  req: Request,
  env: { url?: string; apikey?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<UserCheck> {
  const token = bearerToken(req);
  if (!looksLikeJwt(token)) return { ok: false, status: 401, error: "Aanmelden vereist: log in met je persoonlijke account." };
  const base = String(env.url || "").replace(/\/+$/, "");
  const apikey = env.apikey || req.headers.get("apikey") || "";
  if (!base || !apikey) return { ok: false, status: 500, error: "Serverconfiguratie onvolledig (SUPABASE_URL)." };
  try {
    const res = await fetchImpl(`${base}/auth/v1/user`, { headers: { apikey, Authorization: `Bearer ${token}` } });
    if (!res.ok) return { ok: false, status: 401, error: "Sessie ongeldig of verlopen: log opnieuw in." };
    const user = await res.json().catch(() => null) as { id?: string } | null;
    if (!user || typeof user.id !== "string" || !user.id) return { ok: false, status: 401, error: "Sessie ongeldig." };
    return { ok: true, userId: user.id };
  } catch (_) {
    return { ok: false, status: 503, error: "Aanmeldcontrole tijdelijk niet bereikbaar." };
  }
}

// Best-effort limiet per gebruiker binnen één functie-instantie. Niet duurzaam (instanties kunnen herstarten);
// beschermt tegen per ongeluk lussen en eenvoudig misbruik van de externe API-quota.
export function createRateLimiter(limit = 30, windowMs = 60_000) {
  const hits = new Map<string, number[]>();
  return function allow(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) { hits.set(key, recent); return false; }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 1000) hits.delete(hits.keys().next().value as string);
    return true;
  };
}

// Leest JSON met groottelimiet; geeft null bij te groot of ongeldig.
export async function readJsonBody(req: Request, maxBytes = MAX_BODY_BYTES): Promise<Record<string, unknown> | null> {
  const declared = Number(req.headers.get("content-length") || "0");
  if (declared > maxBytes) return null;
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) return null;
  try {
    const value = JSON.parse(text || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch (_) {
    return null;
  }
}

export function cleanText(value: unknown, max = 100): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

// Alles-in-één poort voor een POST-functie. Geeft óf een Response (afwijzing/preflight) óf de context terug.
export async function guard(
  req: Request,
  opts: { env: { url?: string; apikey?: string; allowedOrigins?: string }; limiter: (key: string) => boolean; fetchImpl?: typeof fetch },
): Promise<{ response: Response } | { userId: string; body: Record<string, unknown>; headers: Record<string, string> }> {
  const allowed = parseAllowedOrigins(opts.env.allowedOrigins);
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin, allowed);
  const reply = (status: number, error: string) =>
    ({ response: new Response(JSON.stringify({ error }), { status, headers: { ...headers, "Content-Type": "application/json" } }) });
  if (req.method === "OPTIONS") return { response: new Response("ok", { status: origin && allowed.includes(origin) ? 200 : 403, headers }) };
  if (req.method !== "POST") return reply(405, "Alleen POST is toegestaan.");
  // Een browser-aanvraag vanaf een niet-toegestane origin wordt geweigerd; server-tot-server (zonder Origin) valt onder de JWT-eis.
  if (origin && !allowed.includes(origin)) return reply(403, "Origin niet toegestaan.");
  const user = await requireUser(req, opts.env, opts.fetchImpl);
  if (!user.ok) return reply(user.status, user.error);
  if (!opts.limiter(user.userId)) return reply(429, "Te veel verzoeken; probeer het over een minuut opnieuw.");
  const body = await readJsonBody(req);
  if (!body) return reply(413, "Verzoek te groot of ongeldig.");
  return { userId: user.userId, body, headers };
}
