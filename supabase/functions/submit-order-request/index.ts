import { type SupabaseContext, withSupabase } from "npm:@supabase/server@^1";

type OrderRequestDetails = {
  category: string;
  product_name: string;
  player_age: number | null;
  budget_eur: number | null;
  details: string;
  pickup_notes: string | null;
};

type OrderRequestInsert = OrderRequestDetails & {
  customer_name: string;
  customer_email: string;
  linked_user_id: string;
};

type OrderRequestRow = OrderRequestInsert & {
  id: number;
  status: string;
  confirmed_order_count: number;
  created_at: string;
};

type Database = {
  public: {
    Tables: {
      order_requests: {
        Row: OrderRequestRow;
        Insert: OrderRequestInsert;
        Update: Partial<OrderRequestInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type ValidSubmission = {
  order: OrderRequestDetails;
  turnstileToken: string;
  honeypot: string;
};

type TurnstileResult = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

const ALLOWED_CATEGORIES = new Set([
  "tcg",
  "jeux-societe",
  "classiques-puzzle-echecs",
  "idee-cadeau",
  "autre",
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const TURNSTILE_ACTION = "order_request";
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

export function validateSubmission(payload: unknown): ValidSubmission | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const input = payload as Record<string, unknown>;

  const category = cleanText(input.category);
  const productName = cleanText(input.product_name);
  const details = cleanText(input.details);
  const pickupNotes = cleanText(input.pickup_notes);
  const honeypot = cleanText(input.company_website);
  const turnstileToken = cleanText(input.turnstile_token);
  const playerAge = parseOptionalNumber(input.player_age);
  const budgetEur = parseOptionalNumber(input.budget_eur);

  if (
    !ALLOWED_CATEGORIES.has(category) ||
    productName.length < 2 ||
    productName.length > 140 ||
    details.length < 20 ||
    details.length > 1000 ||
    pickupNotes.length > 220 ||
    !turnstileToken ||
    turnstileToken.length > 2048 ||
    playerAge === undefined ||
    (playerAge !== null &&
      (!Number.isInteger(playerAge) || playerAge < 0 || playerAge > 120)) ||
    budgetEur === undefined ||
    (budgetEur !== null && (budgetEur <= 0 || budgetEur > 100000))
  ) {
    return null;
  }

  return {
    order: {
      category,
      product_name: productName,
      player_age: playerAge,
      budget_eur: budgetEur,
      details,
      pickup_notes: pickupNotes || null,
    },
    turnstileToken,
    honeypot,
  };
}

export function getAuthenticatedCustomerName(
  userClaims: { userMetadata?: Record<string, unknown> } | null,
  email: string,
): string {
  const displayName = cleanText(userClaims?.userMetadata?.display_name).slice(0, 80);
  if (displayName.length >= 2) return displayName;

  const emailAlias = cleanText(email.split("@", 1)[0]).slice(0, 80);
  return emailAlias.length >= 2 ? emailAlias : "Joueur";
}

function configuredHostnames(): Set<string> {
  const configured = Deno.env.get("TURNSTILE_ALLOWED_HOSTNAMES") ||
    "adriencodevh.github.io,bouguenaisludique.fr,www.bouguenaisludique.fr";
  return new Set(
    configured
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAllowedTurnstileResult(
  result: TurnstileResult,
  allowedHostnames: Set<string>,
): boolean {
  return (
    result.success === true &&
    result.action === TURNSTILE_ACTION &&
    typeof result.hostname === "string" &&
    allowedHostnames.has(result.hostname.toLowerCase())
  );
}

function getClientIp(request: Request): string | null {
  const raw = request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    "";
  const value = raw.trim();
  return value && value.length <= 64 ? value : null;
}

async function verifyTurnstile(
  token: string,
  remoteIp: string | null,
): Promise<TurnstileResult> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    return { success: false, "error-codes": ["missing-input-secret"] };
  }

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (remoteIp) body.append("remoteip", remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body, signal: controller.signal },
    );
    if (!response.ok) {
      return { success: false, "error-codes": ["siteverify_unavailable"] };
    }
    return await response.json() as TurnstileResult;
  } catch {
    return { success: false, "error-codes": ["siteverify_unavailable"] };
  } finally {
    clearTimeout(timeout);
  }
}

async function handler(
  request: Request,
  context: SupabaseContext<Database>,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const payload = await request.json().catch(() => null);
  const submission = validateSubmission(payload);
  if (!submission) {
    return jsonResponse({ error: "invalid_submission" }, 422);
  }

  const authenticatedUserId = cleanText(context.userClaims?.id);
  const authenticatedEmail = cleanText(context.userClaims?.email).toLowerCase();
  if (!authenticatedUserId || !EMAIL_PATTERN.test(authenticatedEmail)) {
    return jsonResponse({ error: "authentication_required" }, 401);
  }
  const authenticatedCustomerName = getAuthenticatedCustomerName(
    context.userClaims,
    authenticatedEmail,
  );

  // Un robot simple remplit souvent les champs masqués. On répond comme pour
  // un succès afin de ne pas lui révéler la protection, sans écrire en base.
  if (submission.honeypot) {
    return jsonResponse({ ok: true }, 202);
  }

  const turnstileResult = await verifyTurnstile(
    submission.turnstileToken,
    getClientIp(request),
  );
  if (!isAllowedTurnstileResult(turnstileResult, configuredHostnames())) {
    return jsonResponse({ error: "verification_failed" }, 403);
  }

  const duplicateSince = new Date(Date.now() - DUPLICATE_WINDOW_MS)
    .toISOString();
  const { count, error: rateLimitError } = await context.supabaseAdmin
    .from("order_requests")
    .select("id", { count: "exact", head: true })
    .eq("linked_user_id", authenticatedUserId)
    .gte("created_at", duplicateSince);

  if (rateLimitError) {
    return jsonResponse({ error: "database_unavailable" }, 503);
  }
  if ((count || 0) > 0) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const order: OrderRequestInsert = {
    ...submission.order,
    customer_name: authenticatedCustomerName,
    customer_email: authenticatedEmail,
    linked_user_id: authenticatedUserId,
  };

  const { error: insertError } = await context.supabaseAdmin
    .from("order_requests")
    .insert(order);

  if (insertError) {
    return jsonResponse({ error: "database_unavailable" }, 503);
  }

  return jsonResponse({ ok: true }, 201);
}

export default {
  fetch: withSupabase<Database>(
    {
      auth: "user",
      cors: {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "apikey, authorization, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      },
    },
    handler,
  ),
};
