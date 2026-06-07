(function () {
  const form = document.getElementById("order-request-form");
  const feedback = document.getElementById("order-request-feedback");
  const authRequired = document.getElementById("order-request-auth-required");
  if (!form || !feedback || !window.BLAuth) return;

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

  function getCurrentSession() {
    return window.BLAuthUi?.getStoredSession?.() || null;
  }

  function getAccessToken() {
    const session = getCurrentSession();
    return session && session.access_token ? session.access_token : "";
  }

  function getAccountEmail(accessToken) {
    const payload = window.BLAuthUi?.parseJwtPayload?.(accessToken);
    return trimValue(payload && payload.email).toLowerCase();
  }

  function updateAuthenticatedView() {
    const accessToken = getAccessToken();
    const isLoggedIn = Boolean(accessToken);
    form.hidden = !isLoggedIn;
    if (authRequired) authRequired.hidden = isLoggedIn;

    if (!isLoggedIn) return;

    const accountEmail = getAccountEmail(accessToken);
    if (accountEmail && form.customer_email) {
      form.customer_email.value = accountEmail;
      form.customer_email.readOnly = true;
    }
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
    };
  }

  async function submitOrderRequest(values, accessToken) {
    const cfg = window.BLAuth.getSupabaseConfig();
    if (!cfg || !cfg.isConfigured) {
      throw new Error("Configuration Supabase manquante. Écrivez directement à bouguenaisludique@gmail.com.");
    }
    if (!accessToken) {
      throw new Error("Connectez-vous avant d'envoyer une demande de commande.");
    }

    const res = await fetch(`${cfg.url}/rest/v1/order_requests`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(buildPayload(values)),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        throw new Error("Votre session ne permet pas d'envoyer cette demande. Reconnectez-vous puis réessayez.");
      }
      throw new Error(data.message || data.error || "La demande n'a pas pu être envoyée.");
    }
  }

  updateAuthenticatedView();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback("");

    const accessToken = getAccessToken();
    if (!accessToken) {
      updateAuthenticatedView();
      setFeedback("Connectez-vous avant d'envoyer une demande de commande.", true);
      return;
    }

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
      await submitOrderRequest(values, accessToken);
      form.reset();
      updateAuthenticatedView();
      setFeedback("Demande envoyée. Je reviens vers vous par e-mail pour confirmer les possibilités.", false);
    } catch (err) {
      setFeedback(err && err.message ? err.message : "La demande n'a pas pu être envoyée.", true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  window.BLOrderRequest = {
    validateOrderRequest,
    buildPayload,
  };
})();
