import { withSupabase } from "npm:@supabase/server@^1";

type OrderRequest = {
  id: number;
  customer_name: string;
  customer_email: string;
  category: string;
  product_name: string;
  player_age: number | null;
  budget_eur: number | string | null;
  details: string;
  pickup_notes: string | null;
  status: string;
  confirmed_order_count: number;
  created_at: string;
};

type InsertPayload = {
  type: "INSERT";
  table: string;
  schema: string;
  record: OrderRequest;
  old_record: null;
};

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatOptional(value: unknown, fallback = "Non précisé"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatCategory(category: string): string {
  const labels: Record<string, string> = {
    tcg: "Jeux de cartes à collectionner",
    "jeux-societe": "Jeux de société",
    "classiques-puzzle-echecs": "Classiques, puzzle et échecs",
    "idee-cadeau": "Idée cadeau / conseil",
    autre: "Autre demande",
  };
  return labels[category] || category;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

function formatSubjectProduct(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function isValidPayload(payload: unknown): payload is InsertPayload {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Partial<InsertPayload>;
  const record = candidate.record as Partial<OrderRequest> | undefined;

  return (
    candidate.type === "INSERT" &&
    candidate.schema === "public" &&
    candidate.table === "order_requests" &&
    Boolean(record) &&
    Number.isInteger(record?.id) &&
    typeof record?.customer_name === "string" &&
    typeof record?.customer_email === "string" &&
    typeof record?.product_name === "string" &&
    typeof record?.details === "string" &&
    record?.status === "new" &&
    record?.confirmed_order_count === 0
  );
}

function buildTextEmail(order: OrderRequest, adminUrl: string): string {
  return [
    "Une nouvelle demande de commande vient d'être envoyée.",
    "",
    `Demandeur : ${order.customer_name}`,
    `E-mail : ${order.customer_email}`,
    `Univers : ${formatCategory(order.category)}`,
    `Produit : ${order.product_name}`,
    `Âge : ${formatOptional(order.player_age)}`,
    `Budget : ${order.budget_eur == null ? "Non précisé" : `${order.budget_eur} €`}`,
    `Détails : ${order.details}`,
    `Retrait : ${formatOptional(order.pickup_notes)}`,
    `Reçue le : ${formatDate(order.created_at)}`,
    "",
    `Traiter la demande : ${adminUrl}`,
  ].join("\n");
}

function buildHtmlEmail(order: OrderRequest, adminUrl: string): string {
  const rows = [
    ["Demandeur", order.customer_name],
    ["E-mail", order.customer_email],
    ["Univers", formatCategory(order.category)],
    ["Produit", order.product_name],
    ["Âge", formatOptional(order.player_age)],
    ["Budget", order.budget_eur == null ? "Non précisé" : `${order.budget_eur} €`],
    ["Détails", order.details],
    ["Retrait", formatOptional(order.pickup_notes)],
    ["Reçue le", formatDate(order.created_at)],
  ]
    .map(
      ([label, value]) =>
        `<tr><th style="padding:8px;text-align:left;vertical-align:top">${escapeHtml(label)}</th>` +
        `<td style="padding:8px">${escapeHtml(value).replaceAll("\n", "<br>")}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="fr">
  <body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
    <h1 style="font-size:22px">Nouvelle demande de commande</h1>
    <table style="border-collapse:collapse;max-width:680px">${rows}</table>
    <p style="margin-top:24px">
      <a href="${escapeHtml(adminUrl)}" style="background:#3346a8;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px">
        Traiter la demande
      </a>
    </p>
  </body>
</html>`;
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const notificationTo = Deno.env.get("ORDER_NOTIFICATION_TO");
  const notificationFrom =
    Deno.env.get("ORDER_NOTIFICATION_FROM") ||
    "Bouguenais Ludique <onboarding@resend.dev>";
  const adminUrl =
    Deno.env.get("ORDER_ADMIN_URL") ||
    "https://adriencodevh.github.io/BouguenaisLudique/pages/admin-demandes.html";

  if (!resendApiKey || !notificationTo) {
    return jsonResponse({ error: "notification_not_configured" }, 500);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  if (!isValidPayload(payload)) {
    return jsonResponse({ error: "invalid_webhook_payload" }, 422);
  }

  const order = payload.record;
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: notificationFrom,
      to: [notificationTo],
      reply_to: order.customer_email,
      subject: `Nouvelle demande — ${formatSubjectProduct(order.product_name)}`,
      text: buildTextEmail(order, adminUrl),
      html: buildHtmlEmail(order, adminUrl),
    }),
  });

  const resendBody = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok) {
    return jsonResponse(
      { error: "email_provider_error", provider_status: resendResponse.status },
      502,
    );
  }

  return jsonResponse({
    ok: true,
    order_request_id: order.id,
    email_id:
      resendBody && typeof resendBody === "object" && "id" in resendBody
        ? resendBody.id
        : null,
  });
}

const protectedHandler = withSupabase({ auth: "secret:*" }, handler);

function normalizeWebhookAuth(request: Request): Request {
  const headers = new Headers(request.headers);
  const authorization = headers.get("authorization");

  // Database Webhooks envoie la clé du projet sous la forme
  // `Authorization: Bearer ...`, tandis que @supabase/server attend les clés
  // secrètes dans `apikey`. La valeur reste ensuite validée par le wrapper.
  if (!headers.has("apikey") && authorization?.startsWith("Bearer ")) {
    const secretKey = authorization.slice(7).trim();
    if (secretKey) headers.set("apikey", secretKey);
  }

  return new Request(request, { headers });
}

// Le wrapper refuse les appels publics ou anonymes : seule une clé secrète
// appartenant au projet Supabase permet d'atteindre le gestionnaire.
export default {
  fetch: (request: Request) => protectedHandler(normalizeWebhookAuth(request)),
};
