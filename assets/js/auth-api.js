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

function getRetryAfterSeconds(response) {
  const value = response.headers.get("Retry-After");
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));

  const retryDate = Date.parse(value);
  if (Number.isNaN(retryDate)) return null;
  return Math.max(0, Math.ceil((retryDate - Date.now()) / 1000));
}

async function signUpWithEmail(email, password, userMetadata, emailRedirectTo) {
  const { url, key } = getSupabaseConfig();
  assertBrowserSafeKey(key);
  const signupUrl = new URL(`${url}/auth/v1/signup`);
  if (emailRedirectTo) {
    signupUrl.searchParams.set("redirect_to", emailRedirectTo);
  }

  const res = await fetch(signupUrl.toString(), {
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
    const error = new Error(raw);
    error.status = res.status;
    error.code = data.code || "";
    error.retryAfterSeconds = getRetryAfterSeconds(res);
    throw error;
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
