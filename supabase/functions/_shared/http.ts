// Shared HTTP helpers for edge functions: origin-restricted CORS and
// internal (cron / service) caller authorisation.

const ALLOWED_ORIGINS = [
  "https://holdingstructure.app",
  "https://www.holdingstructure.app",
  "https://firm-structure-pro.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

// Lovable preview/sandbox hosts are dynamic, so match them by pattern.
const ALLOWED_ORIGIN_PATTERNS = [/^https:\/\/[a-z0-9-]+\.lovable\.app$/i, /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i];

const BASE_HEADERS = "authorization, x-client-info, apikey, content-type, x-internal-secret";

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
}

/**
 * Builds CORS headers for the request, echoing back only allow-listed origins.
 * Requests without an Origin header (server-to-server, cron) are unaffected.
 */
export function corsFor(req: Request, extraHeaders = ""): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowHeaders = extraHeaders ? `${BASE_HEADERS}, ${extraHeaders}` : BASE_HEADERS;
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

/**
 * Guards service-role functions that operate across every workspace
 * (scheduled jobs, digests). Only the platform scheduler / an operator holding
 * the internal secret or the service role key may invoke them.
 *
 * Returns a 403 Response when the caller is not authorised, otherwise null.
 */
export function requireInternalAuth(req: Request, corsHeaders: Record<string, string>): Response | null {
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const providedSecret = req.headers.get("x-internal-secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const authorized =
    (!!internalSecret && providedSecret === internalSecret) || (!!serviceRoleKey && bearer === serviceRoleKey);

  if (authorized) return null;

  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
