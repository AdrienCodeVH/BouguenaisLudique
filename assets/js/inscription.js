(function () {
  const form = document.getElementById("signup-form");
  const feedback = document.getElementById("signup-feedback");
  if (!form || !feedback || !window.BLAuth) return;

  const emailRateLimitFallbackSeconds = 60 * 60;
  let emailRateLimitTimerId = null;

  const shouldReturnToOrder = new URLSearchParams(window.location.search).get("next") === "order";

  function getSuccessDestination() {
    return shouldReturnToOrder
      ? "./catalogue.html?resume=order#demande-commande"
      : "../index.html";
  }

  function getEmailConfirmationMessage() {
    const nextStep = shouldReturnToOrder
      ? "puis connecte-toi pour reprendre ta demande."
      : "puis connecte-toi.";

    return `Compte créé ! Un e-mail de confirmation vient de t’être envoyé. Ouvre-le pour activer ton compte, ${nextStep} Pense à vérifier tes courriers indésirables.`;
  }

  function getEmailConfirmationDestination() {
    return new URL("./compte-confirme.html", window.location.href).href;
  }

  const loginLink = form.querySelector('.auth-alt-link a[href$="connexion.html"]');
  if (shouldReturnToOrder && loginLink) {
    loginLink.href = "./connexion.html?next=order";
  }

  function setFeedback(message, isError) {
    feedback.textContent = message;
    feedback.classList.toggle("form-feedback--error", Boolean(isError));
    feedback.hidden = !message;
  }

  function isEmailRateLimitError(error) {
    const message = String(error?.message || "").toLowerCase();
    const code = String(error?.code || "").toLowerCase();
    return (
      code === "over_email_send_rate_limit" ||
      message.includes("email rate limit")
    );
  }

  function formatCountdown(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
  }

  function startEmailRateLimitCountdown(error) {
    if (emailRateLimitTimerId) window.clearInterval(emailRateLimitTimerId);

    const hasRetryAfter = error?.retryAfterSeconds != null;
    const retryAfterSeconds = Number(error?.retryAfterSeconds);
    const initialSeconds = hasRetryAfter && Number.isFinite(retryAfterSeconds)
      ? Math.max(1, Math.ceil(retryAfterSeconds))
      : emailRateLimitFallbackSeconds;
    const retryAt = Date.now() + initialSeconds * 1000;

    const updateCountdown = () => {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((retryAt - Date.now()) / 1000)
      );

      if (remainingSeconds === 0) {
        window.clearInterval(emailRateLimitTimerId);
        emailRateLimitTimerId = null;
        setFeedback(
          "Le délai conseillé est terminé. Tu peux réessayer de créer ton compte.",
          false
        );
        return;
      }

      setFeedback(
        `Le service d’envoi des e-mails a atteint sa limite temporaire. Prochain essai conseillé dans ${formatCountdown(remainingSeconds)}.`,
        true
      );
    };

    updateCountdown();
    emailRateLimitTimerId = window.setInterval(updateCountdown, 1000);
  }

  function getSignupErrorMessage(error) {
    const message = String(error?.message || "").trim();
    const code = String(error?.code || "").toLowerCase();

    if (isEmailRateLimitError(error)) {
      return "Le service d’envoi des e-mails a atteint sa limite temporaire. Merci de patienter jusqu’à une heure avant de réessayer.";
    }

    if (error?.status === 429 || code === "over_request_rate_limit") {
      return "Trop de tentatives ont été effectuées. Merci de patienter quelques minutes avant de réessayer.";
    }

    return message || "Une erreur est survenue.";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setFeedback("");

    const email = form.email.value.trim();
    const password = form.password.value;
    const confirm = form.confirm.value;
    const displayName = form.display_name.value.trim();
    const consent = document.getElementById("signup-consent");

    if (!email || !password) {
      setFeedback("Renseigne ton e-mail et un mot de passe.", true);
      return;
    }
    if (password.length < 8) {
      setFeedback("Le mot de passe doit contenir au moins 8 caractères.", true);
      return;
    }
    if (password !== confirm) {
      setFeedback("Les deux mots de passe ne correspondent pas.", true);
      return;
    }
    if (!consent || !consent.checked) {
      setFeedback("Merci d’accepter les conditions pour continuer.", true);
      return;
    }

    const cfg = window.BLAuth.getSupabaseConfig();
    if (!cfg.isConfigured) {
      let detail =
        "Ouvre le fichier assets/js/auth-config.js et colle tes identifiants.";
      if (cfg.hasUrl && !cfg.hasKey) {
        detail =
          "Il manque la clé « anon public » : dans Supabase → Project Settings → API, copie la clé anon (longue chaîne eyJ…) dans BL_SUPABASE_ANON_KEY.";
      } else if (!cfg.hasUrl && cfg.hasKey) {
        detail =
          "Il manque l’URL du projet dans BL_SUPABASE_URL (ex. https://xxxx.supabase.co).";
      }
      setFeedback(detail, true);
      return;
    }

    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.setAttribute("aria-busy", "true");

    try {
      const data = await window.BLAuth.signUpWithEmail(
        email,
        password,
        { display_name: displayName || undefined },
        getEmailConfirmationDestination()
      );

      const access =
        data.access_token ||
        (data.session && data.session.access_token);
      const refresh =
        data.refresh_token ||
        (data.session && data.session.refresh_token);
      const expires =
        data.expires_at != null
          ? data.expires_at
          : data.session && data.session.expires_at;

      if (access) {
        sessionStorage.setItem(
          "bl_auth_session",
          JSON.stringify({
            access_token: access,
            refresh_token: refresh,
            expires_at: expires,
          })
        );
        setFeedback(
          shouldReturnToOrder
            ? "Compte créé. Retour vers votre demande…"
            : "Compte créé. Redirection…",
          false
        );
        window.location.href = getSuccessDestination();
        return;
      }

      setFeedback(getEmailConfirmationMessage(), false);
      form.reset();
    } catch (err) {
      if (isEmailRateLimitError(err)) {
        startEmailRateLimitCountdown(err);
      } else {
        setFeedback(getSignupErrorMessage(err), true);
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.removeAttribute("aria-busy");
    }
  });
})();

(function authConfigBanner() {
  const cfg = window.BLAuth?.getSupabaseConfig?.();
  if (!cfg || cfg.isConfigured) return;

  const form = document.getElementById("signup-form");
  const wrap = form?.closest(".container--narrow");
  if (!wrap || document.getElementById("auth-config-banner")) return;

  const div = document.createElement("div");
  div.id = "auth-config-banner";
  div.className = "auth-config-banner";
  div.setAttribute("role", "status");

  if (cfg.hasKey && window.BLAuth.isSecretKeyFormat?.(window.BL_SUPABASE_ANON_KEY)) {
    div.innerHTML =
      "<p><strong>Mauvais type de clé.</strong> Ta clé commence par <code>sb_secret_</code> : c’est la clé <strong>secrète</strong> (réservée au serveur). Utilise la clé <strong>Publishable</strong> (souvent <code>sb_publishable_</code> ou <code>eyJ…</code>) dans <code>auth-config.js</code> — onglet <em>Project Settings → API</em>.</p>";
  } else if (cfg.hasUrl && !cfg.hasKey) {
    div.innerHTML =
      "<p><strong>Il manque la clé publique.</strong> Supabase → <em>Project Settings → API</em> → copie la clé <strong>Publishable</strong> / <strong>anon public</strong> (pas « Secret »). Colle-la dans <code>assets/js/auth-config.js</code> : <code>window.BL_SUPABASE_ANON_KEY = \"…\"</code>.</p>";
  } else {
    div.innerHTML =
      "<p>Renseigne <code>BL_SUPABASE_URL</code> et <code>BL_SUPABASE_ANON_KEY</code> dans <code>assets/js/auth-config.js</code> (voir <code>auth-config.example.js</code>).</p>";
  }

  wrap.insertBefore(div, form);
})();
