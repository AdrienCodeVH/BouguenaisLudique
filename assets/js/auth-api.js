/**
 * Appels Auth Supabase via API REST (sans bundler).
 * Les utilisateurs sont stockés côté Supabase dans auth.users ;
 * les métadonnées optionnelles passent dans user_metadata.
 */

/** Clé secrète (sb_secret_…) interdite dans le navigateur — utiliser Publishable / anon. */
function assertBrowserSafeKey(key) {
  const k = (key || "").trim();
  if (!k) return;
  if (/^sb_secret_/i.test(k)) {
    throw new Error(
      "Tu as collé une clé SECRÈTE (sb_secret_…). Dans Supabase : Project Settings → API → copie la clé « Publishable » (navigateur), pas « Secret »."
    );
  }
}

function getSupabaseConfig() {
  const url = (typeof window !== "undefined" && window.BL_SUPABASE_URL) || "";
  const key =
    (typeof window !== "undefined" && window.BL_SUPABASE_ANON_KEY) || "";
  const trimmedUrl = url.trim().replace(/\/$/, "");
  const trimmedKey = key.trim();
  return {
    url: trimmedUrl,
    key: trimmedKey,
    isConfigured: Boolean(trimmedUrl && trimmedKey),
    hasUrl: Boolean(trimmedUrl),
    hasKey: Boolean(trimmedKey),
  };
}

async function signUpWithEmail(email, password, userMetadata) {
  const { url, key } = getSupabaseConfig();
  assertBrowserSafeKey(key);
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      email,
      password,
      data: userMetadata || {},
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw =
      data.msg ||
      data.error_description ||
      data.message ||
      data.error ||
      "Inscription impossible.";
    if (
      String(raw).toLowerCase().includes("secret") &&
      String(raw).toLowerCase().includes("browser")
    ) {
      throw new Error(
        "Mauvaise clé : utilise la clé Publishable / anon dans auth-config.js, pas la clé Secret (Project Settings → API)."
      );
    }
    throw new Error(raw);
  }
  return data;
}

async function signInWithPassword(email, password) {
  const { url, key } = getSupabaseConfig();
  assertBrowserSafeKey(key);

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw =
      data.error_description ||
      data.msg ||
      data.message ||
      data.error ||
      "Connexion impossible.";
    if (
      String(raw).toLowerCase().includes("secret") &&
      String(raw).toLowerCase().includes("browser")
    ) {
      throw new Error(
        "Mauvaise clé : utilise la clé Publishable / anon, pas la clé Secret."
      );
    }
    throw new Error(raw);
  }
  return data;
}

window.BLAuth = {
  getSupabaseConfig,
  signUpWithEmail,
  signInWithPassword,
  isSecretKeyFormat: (k) => /^sb_secret_/i.test((k || "").trim()),
};
