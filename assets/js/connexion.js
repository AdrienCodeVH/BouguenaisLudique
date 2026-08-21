(function () {
  const form = document.getElementById("login-form");
  const feedback = document.getElementById("login-feedback");
  if (!form || !feedback || !window.BLAuth) return;

  const shouldReturnToOrder = new URLSearchParams(window.location.search).get("next") === "order";

  function getSuccessDestination() {
    return shouldReturnToOrder
      ? "./catalogue.html?resume=order#demande-commande"
      : "../index.html";
  }

  const signupLink = form.querySelector('.auth-alt-link a[href$="inscription.html"]');
  if (shouldReturnToOrder && signupLink) {
    signupLink.href = "./inscription.html?next=order";
  }

  function toFriendlyLoginError(err) {
    const raw = String(err && err.message ? err.message : "").toLowerCase();
    if (!raw) return "Connexion impossible. Réessaie dans quelques instants.";
    if (raw.includes("invalid login credentials")) {
      return "E-mail ou mot de passe incorrect.";
    }
    if (raw.includes("email not confirmed")) {
      return "Ton e-mail n'est pas encore confirmé. Vérifie ta boîte mail.";
    }
    if (raw.includes("failed to fetch") || raw.includes("network")) {
      return "Connexion au serveur impossible. Vérifie ta connexion internet.";
    }
    if (raw.includes("secret") && raw.includes("clé")) {
      return err.message;
    }
    return "Connexion impossible. Vérifie tes identifiants et réessaie.";
  }

  function setFeedback(message, isError) {
    feedback.textContent = message;
    feedback.classList.toggle("form-feedback--error", Boolean(isError));
    feedback.hidden = !message;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setFeedback("");

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      setFeedback("Renseigne ton e-mail et ton mot de passe.", true);
      return;
    }

    const cfg = window.BLAuth.getSupabaseConfig();
    if (!cfg.isConfigured) {
      let detail =
        "Ouvre assets/js/auth-config.js et renseigne l’URL + la clé anon.";
      if (cfg.hasUrl && !cfg.hasKey) {
        detail =
          "Colle la clé anon public (Supabase → Project Settings → API) dans BL_SUPABASE_ANON_KEY.";
      } else if (!cfg.hasUrl && cfg.hasKey) {
        detail = "Ajoute BL_SUPABASE_URL (https://….supabase.co).";
      }
      setFeedback(detail, true);
      return;
    }

    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;

    try {
      const data = await window.BLAuth.signInWithPassword(email, password);
      sessionStorage.setItem(
        "bl_auth_session",
        JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at,
        })
      );
      setFeedback(
        shouldReturnToOrder
          ? "Connexion réussie. Retour vers votre demande…"
          : "Connexion réussie. Redirection…",
        false
      );
      window.location.href = getSuccessDestination();
    } catch (err) {
      setFeedback(toFriendlyLoginError(err), true);
    } finally {
      submitBtn.disabled = false;
    }
  });
})();

(function authConfigBannerLogin() {
  const cfg = window.BLAuth?.getSupabaseConfig?.();
  if (!cfg || cfg.isConfigured) return;

  const form = document.getElementById("login-form");
  const wrap = form?.closest(".container--narrow");
  if (!wrap || document.getElementById("auth-config-banner")) return;

  const div = document.createElement("div");
  div.id = "auth-config-banner";
  div.className = "auth-config-banner";
  div.setAttribute("role", "status");

  if (cfg.hasKey && window.BLAuth.isSecretKeyFormat?.(window.BL_SUPABASE_ANON_KEY)) {
    div.innerHTML =
      "<p><strong>Clé secrète détectée.</strong> Remplace <code>sb_secret_…</code> par la clé <strong>Publishable</strong> (Project Settings → API), pas « Secret ».</p>";
  } else if (cfg.hasUrl && !cfg.hasKey) {
    div.innerHTML =
      "<p><strong>Clé publique manquante.</strong> Supabase → <em>Project Settings → API</em> → <strong>Publishable</strong> / anon, dans <code>auth-config.js</code>.</p>";
  } else {
    div.innerHTML =
      "<p>Complète <code>assets/js/auth-config.js</code> (<code>BL_SUPABASE_URL</code> + <code>BL_SUPABASE_ANON_KEY</code>).</p>";
  }

  wrap.insertBefore(div, form);
})();
