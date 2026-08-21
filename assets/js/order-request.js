(function () {
  const form = document.getElementById("order-request-form");
  const feedback = document.getElementById("order-request-feedback");
  const turnstileContainer = document.getElementById("order-request-turnstile");
  if (!form || !feedback || !window.BLAuth) return;

  let turnstileToken = "";
  let turnstileWidgetId = null;

  const allowedCategories = [
    "tcg",
    "jeux-societe",
    "classiques-puzzle-echecs",
    "idee-cadeau",
    "autre",
  ];

  function trimValue(value) {
    return String(value || "").trim();
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function parseOptionalNumber(value) {
    const trimmed = trimValue(value);
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function collectOrderRequestValues() {
    return {
      customer_name: trimValue(form.customer_name.value),
      customer_email: trimValue(form.customer_email.value).toLowerCase(),
      category: trimValue(form.category.value),
      product_name: trimValue(form.product_name.value),
      player_age: parseOptionalNumber(form.player_age.value),
      budget_eur: parseOptionalNumber(form.budget_eur.value),
      details: trimValue(form.details.value),
      pickup_notes: trimValue(form.pickup_notes.value),
      company_website: trimValue(form.company_website.value),
      turnstile_token: turnstileToken,
      consent: form.consent.checked,
    };
  }

  function validateOrderRequest(values) {
    const errors = {};

    if (values.customer_name.length < 2) {
      errors.customer_name = "Indiquez au moins 2 caractères pour le nom ou pseudo.";
    }
    if (!isValidEmail(values.customer_email)) {
      errors.customer_email = "Indiquez une adresse e-mail valide.";
    }
    if (!allowedCategories.includes(values.category)) {
      errors.category = "Choisissez un univers de jeu.";
    }
    if (values.product_name.length < 2) {
      errors.product_name = "Indiquez le jeu, le produit ou le type de demande recherché.";
    }
    if (values.player_age !== null) {
      if (!Number.isInteger(values.player_age) || values.player_age < 0 || values.player_age > 120) {
        errors.player_age = "Indiquez un âge entier entre 0 et 120 ans.";
      }
    }
    if (values.budget_eur !== null) {
      if (!Number.isFinite(values.budget_eur) || values.budget_eur <= 0) {
        errors.budget_eur = "Indiquez un budget supérieur à 0 €, ou laissez le champ vide.";
      }
    }
    if (values.details.length < 20) {
      errors.details = "Ajoutez au moins 20 caractères pour préciser la demande.";
    }
    if (values.pickup_notes.length > 220) {
      errors.pickup_notes = "Les contraintes de retrait doivent rester sous 220 caractères.";
    }
    if (!values.consent) {
      errors.consent = "Acceptez d'être recontacté pour envoyer la demande.";
    }
    if (!values.turnstile_token) {
      errors.turnstile_token = "Confirmez la vérification anti-robot avant l'envoi.";
    }

    return errors;
  }

  function setFeedback(message, isError) {
    feedback.textContent = message;
    feedback.classList.toggle("form-feedback--error", Boolean(isError));
    feedback.hidden = !message;
  }

  function resetFieldValidity() {
    Array.from(form.elements).forEach((field) => {
      if (typeof field.setCustomValidity === "function") {
        field.setCustomValidity("");
      }
    });
  }

  function applyValidationErrors(errors) {
    resetFieldValidity();
    Object.entries(errors).forEach(([name, message]) => {
      const field = form.elements[name];
      if (field && typeof field.setCustomValidity === "function") {
        field.setCustomValidity(message);
      }
    });

    const firstInvalidName = Object.keys(errors)[0];
    if (firstInvalidName && form.elements[firstInvalidName]) {
      form.elements[firstInvalidName].reportValidity();
    }
  }

  function buildPayload(values) {
    return {
      customer_name: values.customer_name,
      customer_email: values.customer_email,
      category: values.category,
      product_name: values.product_name,
      player_age: values.player_age,
      budget_eur: values.budget_eur,
      details: values.details,
      pickup_notes: values.pickup_notes || null,
      company_website: values.company_website,
      turnstile_token: values.turnstile_token,
    };
  }

  function resetTurnstile() {
    turnstileToken = "";
    if (
      turnstileWidgetId !== null &&
      window.turnstile &&
      typeof window.turnstile.reset === "function"
    ) {
      window.turnstile.reset(turnstileWidgetId);
    }
  }

  function renderTurnstile() {
    if (!turnstileContainer || !window.turnstile || turnstileWidgetId !== null) return;

    const sitekey = trimValue(window.BL_TURNSTILE_SITE_KEY);
    if (!sitekey || sitekey === "VOTRE_CLE_SITE_TURNSTILE") {
      setFeedback("La protection anti-robot n'est pas encore configurée.", true);
      return;
    }

    turnstileWidgetId = window.turnstile.render(turnstileContainer, {
      sitekey,
      action: "order_request",
      language: "fr",
      callback(token) {
        turnstileToken = token;
        setFeedback("");
      },
      "expired-callback"() {
        turnstileToken = "";
        setFeedback("La vérification anti-robot a expiré. Recommencez-la avant l'envoi.", true);
      },
      "error-callback"() {
        turnstileToken = "";
        setFeedback("La vérification anti-robot n'a pas pu charger. Réessayez.", true);
      },
    });
  }

  window.blTurnstileReady = renderTurnstile;

  async function submitOrderRequest(values) {
    const cfg = window.BLAuth.getSupabaseConfig();
    if (!cfg || !cfg.isConfigured) {
      throw new Error("Configuration Supabase manquante. Écrivez directement à bouguenaisludique@gmail.com.");
    }

    const res = await fetch(`${cfg.url}/functions/v1/submit-order-request`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayload(values)),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const messages = {
        verification_failed: "La vérification anti-robot a expiré ou a échoué. Recommencez-la.",
        rate_limited: "Une demande vient déjà d'être envoyée avec cet e-mail. Patientez deux minutes.",
        invalid_submission: "Vérifiez les informations du formulaire avant de réessayer.",
      };
      throw new Error(messages[data.error] || "La demande n'a pas pu être envoyée.");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback("");

    const values = collectOrderRequestValues();
    const errors = validateOrderRequest(values);
    if (Object.keys(errors).length) {
      applyValidationErrors(errors);
      setFeedback(Object.values(errors)[0], true);
      return;
    }

    resetFieldValidity();
    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      await submitOrderRequest(values);
      form.reset();
      resetTurnstile();
      setFeedback("Demande envoyée. Je reviens vers vous par e-mail pour confirmer les possibilités.", false);
    } catch (err) {
      resetTurnstile();
      setFeedback(err && err.message ? err.message : "La demande n'a pas pu être envoyée.", true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  window.BLOrderRequest = {
    validateOrderRequest,
    buildPayload,
    renderTurnstile,
  };
})();
