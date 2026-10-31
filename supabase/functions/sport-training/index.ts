const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const disciplines = new Set(["running", "strength", "plyometrics", "cardio", "mobility"]);
const levels = new Set(["beginner", "recreational", "advanced", "experienced"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function validRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !["profile", "request"].includes(key))) return false;
  const profile = body.profile && typeof body.profile === "object" && !Array.isArray(body.profile)
    ? body.profile as Record<string, unknown>
    : null;
  const request = body.request && typeof body.request === "object" && !Array.isArray(body.request)
    ? body.request as Record<string, unknown>
    : null;
  if (!profile || !request) return false;
  if (Object.keys(profile).some(key => !["level", "availableWeeklyMinutes", "availableDays", "equipment"].includes(key))) return false;
  if (Object.keys(request).some(key => !["discipline", "goal", "weeks", "sessionsPerWeek", "sourceIds"].includes(key))) return false;
  if (!levels.has(String(profile.level || ""))) return false;
  if (!Number.isFinite(Number(profile.availableWeeklyMinutes)) || Number(profile.availableWeeklyMinutes) < 20 || Number(profile.availableWeeklyMinutes) > 2000) return false;
  if (!disciplines.has(String(request.discipline || ""))) return false;
  if (typeof request.goal !== "string" || !request.goal.trim() || request.goal.length > 200) return false;
  if (!Number.isInteger(Number(request.weeks)) || Number(request.weeks) < 1 || Number(request.weeks) > 52) return false;
  if (!Number.isInteger(Number(request.sessionsPerWeek)) || Number(request.sessionsPerWeek) < 1 || Number(request.sessionsPerWeek) > 7) return false;
  if (request.sourceIds !== undefined && (!Array.isArray(request.sourceIds) || request.sourceIds.length > 50 || request.sourceIds.some(id => typeof id !== "string" || id.length > 120))) return false;
  if (profile.availableDays !== undefined && (!Array.isArray(profile.availableDays) || profile.availableDays.length > 7)) return false;
  if (profile.equipment !== undefined && (typeof profile.equipment !== "string" || profile.equipment.length > 1000)) return false;
  return true;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Gebruik POST." }, 405);
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || !projectUrl || !publishableKey) return json({ error: "Aanmelden is vereist." }, 401);

  let userResponse: Response;
  try {
    userResponse = await fetch(`${projectUrl.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}` }
    });
  } catch {
    return json({ error: "Aanmeldstatus kon niet worden gecontroleerd." }, 502);
  }
  if (!userResponse.ok) return json({ error: "Aanmelden is vereist." }, 401);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 65536) return json({ error: "De aanvraag is te groot." }, 413);
  let payload: unknown;
  try { payload = JSON.parse(raw); }
  catch { return json({ error: "De aanvraag bevat geen geldige JSON." }, 400); }
  if (!validRequest(payload)) return json({ error: "De trainingsaanvraag heeft een ongeldig formaat of bevat niet-toegestane gegevens." }, 400);
  return json({
    code: "AI_PROVIDER_NOT_CONFIGURED",
    message: "Er is geen AI-provider geconfigureerd. Er is geen AI-schema gegenereerd en de trainingsgegevens zijn niet doorgestuurd."
  }, 503);
});
