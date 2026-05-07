(function () {
  const statusNode = document.getElementById("space-status");
  const form = document.getElementById("space-order-form");
  const feedbackNode = document.getElementById("space-order-feedback");
  const templateSelect = document.getElementById("space-order-template");
  const userBarometersGrid = document.getElementById("space-user-barometers-grid");
  const globalCountNode = document.getElementById("space-global-count");
  const personalCountNode = document.getElementById("space-personal-count");
  const globalFillNode = document.getElementById("space-global-fill");
  const personalFillNode = document.getElementById("space-personal-fill");

  let accessToken = "";
  let userId = "";
  let globalTarget = 0;
  let globalCurrent = 0;
  let personalCurrent = 0;
  let userTemplates = [];
  let userProgressByTemplateId = {};

  function setStatus(message, isError) {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.classList.toggle("form-feedback--error", Boolean(isError));
    statusNode.hidden = !message;
  }

  function setFeedback(message, isError) {
    if (!feedbackNode) return;
    feedbackNode.textContent = message;
    feedbackNode.classList.toggle("form-feedback--error", Boolean(isError));
    feedbackNode.hidden = !message;
  }

  function setFill(fillNode, value) {
    if (!fillNode) return;
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    fillNode.style.setProperty("--bar-target", `${safe}%`);
  }

  function renderCounts() {
    const target = globalTarget > 0 ? globalTarget : 1;
    if (globalCountNode) {
      globalCountNode.textContent = `${globalCurrent} / ${globalTarget} commandes`;
    }
    if (personalCountNode) {
      personalCountNode.textContent = `${personalCurrent} / ${globalTarget} commandes`;
    }
    setFill(globalFillNode, (globalCurrent / target) * 100);
    setFill(personalFillNode, (personalCurrent / target) * 100);
  }

  function renderTemplateSelect() {
    if (!(templateSelect instanceof HTMLSelectElement)) return;
    if (!userTemplates.length) {
      templateSelect.innerHTML = '<option value="" selected>Aucun baromètre disponible</option>';
      templateSelect.disabled = true;
      return;
    }
    templateSelect.disabled = false;
    templateSelect.innerHTML = ['<option value="" selected disabled>Choisir un baromètre</option>']
      .concat(
        userTemplates.map((tpl) => {
          const modeLabel =
            tpl.progression_mode === "one_time_unlock" ? "déblocage unique" : "reset auto";
          return `<option value="${tpl.id}">${tpl.title} (${tpl.target_value} - ${modeLabel})</option>`;
        })
      )
      .join("");
  }

  function renderUserBarometers() {
    if (!userBarometersGrid) return;
    if (!userTemplates.length) {
      userBarometersGrid.innerHTML =
        '<p class="admin-empty">Aucun baromètre utilisateur public configuré pour le moment.</p>';
      return;
    }
    userBarometersGrid.innerHTML = userTemplates
      .map((tpl) => {
        const progressState = userProgressByTemplateId[tpl.id] || {};
        const currentValue = Number(progressState.current_value || 0);
        const completedCount = Number(progressState.completed_count || 0);
        const unlockedAt = progressState.unlocked_at || null;
        const target = Number(tpl.target_value) || 1;
        const progress = Math.max(0, Math.min(100, (currentValue / target) * 100));
        const modeLabel =
          tpl.progression_mode === "one_time_unlock"
            ? "Déblocage unique à vie"
            : "Reset automatique";
        const stateLabel =
          tpl.progression_mode === "one_time_unlock"
            ? unlockedAt
              ? "Avantage débloqué"
              : "En progression"
            : `${completedCount} cycle(s) validé(s)`;
        return `
          <article class="admin-visibility-card">
            <h4>${tpl.title}</h4>
            <p class="admin-empty">${tpl.description || "-"}</p>
            <p class="admin-visibility-metric">${currentValue} / ${target}</p>
            <div class="admin-visibility-track">
              <div class="admin-visibility-fill" style="width:${progress}%"></div>
            </div>
            <p class="admin-empty"><strong>Mode :</strong> ${modeLabel}</p>
            <p class="admin-empty"><strong>Statut :</strong> ${stateLabel}</p>
            <p class="admin-empty"><strong>Récompense :</strong> ${tpl.reward_text}</p>
          </article>
        `;
      })
      .join("");
  }

  function computeNextProgress(template, currentState, orderCount) {
    const target = Math.max(1, Number(template.target_value) || 1);
    const mode = template.progression_mode || "repeatable_reset";
    const currentValue = Number(currentState.current_value || 0);
    const completedCount = Number(currentState.completed_count || 0);
    const unlockedAt = currentState.unlocked_at || null;
    const total = currentValue + orderCount;

    if (mode === "one_time_unlock") {
      const alreadyUnlocked = Boolean(unlockedAt) || currentValue >= target;
      if (alreadyUnlocked) {
        return {
          current_value: target,
          completed_count: Math.max(1, completedCount),
          unlocked_at: unlockedAt || new Date().toISOString(),
        };
      }
      const reached = total >= target;
      return {
        current_value: reached ? target : total,
        completed_count: reached ? Math.max(1, completedCount) : completedCount,
        unlocked_at: reached ? new Date().toISOString() : null,
      };
    }

    const achieved = Math.floor(total / target);
    return {
      current_value: total % target,
      completed_count: completedCount + achieved,
      unlocked_at: null,
    };
  }

  function getConfig() {
    return window.BLAuth?.getSupabaseConfig?.() || null;
  }

  async function apiFetch(path, options) {
    const cfg = getConfig();
    if (!cfg || !cfg.isConfigured) {
      throw new Error("Configuration Supabase manquante.");
    }
    const res = await fetch(`${cfg.url}${path}`, {
      ...options,
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(options && options.headers ? options.headers : {}),
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || data.error || "Erreur API Supabase.");
    }
    return res;
  }

  async function loadGlobalBarometer() {
    const res = await apiFetch(
      "/rest/v1/project_barometer?select=current_orders,target_orders&order=id.asc&limit=1"
    );
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return;
    globalCurrent = Number(rows[0].current_orders) || 0;
    globalTarget = Number(rows[0].target_orders) || 0;
  }

  async function loadPersonalOrders() {
    const res = await apiFetch(
      `/rest/v1/user_orders?select=order_count&user_id=eq.${encodeURIComponent(userId)}`
    );
    const rows = await res.json();
    personalCurrent = Array.isArray(rows)
      ? rows.reduce((sum, row) => sum + (Number(row.order_count) || 0), 0)
      : 0;
  }

  async function loadUserTemplatesAndProgress() {
    const templatesRes = await apiFetch(
      "/rest/v1/user_barometer_templates?select=id,title,description,target_value,progression_mode,reward_text,game_category,is_active&is_active=eq.true&order=created_at.desc"
    );
    userTemplates = await templatesRes.json();

    const progressRes = await apiFetch(
      `/rest/v1/user_barometer_progress?select=template_id,current_value,completed_count,unlocked_at&user_id=eq.${encodeURIComponent(userId)}`
    );
    const progressRows = await progressRes.json();
    userProgressByTemplateId = {};
    if (Array.isArray(progressRows)) {
      progressRows.forEach((row) => {
        userProgressByTemplateId[row.template_id] = {
          current_value: Number(row.current_value) || 0,
          completed_count: Number(row.completed_count) || 0,
          unlocked_at: row.unlocked_at || null,
        };
      });
    }

    renderTemplateSelect();
    renderUserBarometers();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form) return;
    const orderCount = Number(form.order_count.value);
    const note = String(form.note.value || "").trim();
    const templateId = Number(form.template_id.value);
    if (!Number.isFinite(orderCount) || orderCount < 1) {
      setFeedback("Nombre de commandes invalide.", true);
      return;
    }
    if (!Number.isFinite(templateId) || templateId <= 0) {
      setFeedback("Choisis un baromètre utilisateur.", true);
      return;
    }

    try {
      await apiFetch("/rest/v1/user_orders", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          user_id: userId,
          order_count: orderCount,
          note: note || null,
        }),
      });

      const template = userTemplates.find((tpl) => Number(tpl.id) === templateId);
      if (!template) {
        throw new Error("Baromètre utilisateur introuvable.");
      }
      const currentState = userProgressByTemplateId[templateId] || {
        current_value: 0,
        completed_count: 0,
        unlocked_at: null,
      };
      const nextState = computeNextProgress(template, currentState, orderCount);
      await apiFetch("/rest/v1/user_barometer_progress", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          template_id: templateId,
          user_id: userId,
          current_value: nextState.current_value,
          completed_count: nextState.completed_count,
          unlocked_at: nextState.unlocked_at,
          updated_at: new Date().toISOString(),
        }),
      });

      form.reset();
      setFeedback("Commande enregistrée.", false);
      await Promise.all([loadPersonalOrders(), loadUserTemplatesAndProgress()]);
      renderCounts();
    } catch (err) {
      setFeedback(err.message || "Impossible d'enregistrer la commande.", true);
    }
  }

  async function init() {
    const session = window.BLAuthUi?.getStoredSession?.();
    accessToken = session && session.access_token;
    if (!accessToken) {
      setStatus("Connecte-toi pour accéder à ton espace.", true);
      return;
    }

    const payload = window.BLAuthUi?.parseJwtPayload?.(accessToken);
    userId = payload && payload.sub;
    if (!userId) {
      setStatus("Session invalide. Reconnecte-toi.", true);
      return;
    }

    try {
      await Promise.all([loadGlobalBarometer(), loadPersonalOrders(), loadUserTemplatesAndProgress()]);
      renderCounts();
      setStatus("Espace personnel chargé.", false);
    } catch (err) {
      setStatus(err.message || "Impossible de charger les baromètres.", true);
      return;
    }

    form?.addEventListener("submit", handleSubmit);
  }

  init();
})();
