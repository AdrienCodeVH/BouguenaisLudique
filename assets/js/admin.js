(function () {
  const statusNode = document.getElementById("admin-status");
  const accountsSection = document.getElementById("admin-accounts-section");
  const accountsBody = document.getElementById("admin-accounts-body");
  const barometerSection = document.getElementById("admin-barometer-section");
  const barometerForm = document.getElementById("admin-barometer-form");
  const barometerFeedback = document.getElementById("admin-barometer-feedback");
  const thresholdForm = document.getElementById("admin-threshold-form");
  const thresholdFeedback = document.getElementById("admin-threshold-feedback");
  const thresholdsBody = document.getElementById("admin-thresholds-body");
  const barometerPreviewCount = document.getElementById("admin-barometer-preview-count");
  const barometerPreviewTrack = document.getElementById("admin-barometer-preview-track");
  const barometerPreviewFill = document.getElementById("admin-barometer-preview-fill");
  const barometerPreviewHint = document.getElementById("admin-barometer-preview-hint");
  const globalMetricNode = document.getElementById("admin-visibility-global-metric");
  const globalFillNode = document.getElementById("admin-visibility-global-fill");
  const rulesGlobalMetricNode = document.getElementById("admin-visibility-rules-global-metric");
  const rulesGlobalFillNode = document.getElementById("admin-visibility-rules-global-fill");
  const rulesUsersMetricNode = document.getElementById("admin-visibility-rules-users-metric");
  const rulesUsersFillNode = document.getElementById("admin-visibility-rules-users-fill");
  const productsSection = document.getElementById("admin-products-section");
  const productForm = document.getElementById("admin-product-form");
  const productsFeedback = document.getElementById("admin-products-feedback");
  const productsBody = document.getElementById("admin-products-body");
  let accessToken = "";
  let currentUserId = "";
  let currentOrdersValue = 0;

  function setStatus(message, isError) {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.classList.toggle("form-feedback--error", Boolean(isError));
    statusNode.hidden = !message;
  }

  function setFeedback(node, message, isError) {
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("form-feedback--error", Boolean(isError));
    node.hidden = !message;
  }

  function getSupabaseConfig() {
    return window.BLAuth?.getSupabaseConfig?.() || null;
  }

  async function apiFetch(path, options) {
    const cfg = getSupabaseConfig();
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

  function renderAccounts(rows) {
    if (!accountsBody) return;
    if (!rows.length) {
      accountsBody.innerHTML =
        '<tr><td colspan="4" class="admin-empty">Aucun compte trouvé.</td></tr>';
      return;
    }
    accountsBody.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td><code>${row.id}</code></td>
            <td>${row.display_name || "-"}</td>
            <td>
              <select data-role-select data-user-id="${row.id}">
                <option value="client"${row.role === "client" ? " selected" : ""}>client</option>
                <option value="employee"${row.role === "employee" ? " selected" : ""}>employee</option>
                <option value="admin"${row.role === "admin" ? " selected" : ""}>admin</option>
              </select>
            </td>
            <td><button class="btn" type="button" data-role-save data-user-id="${row.id}">Sauver</button></td>
          </tr>
        `
      )
      .join("");
  }

  function renderProducts(rows) {
    if (!productsBody) return;
    if (!rows.length) {
      productsBody.innerHTML =
        '<tr><td colspan="4" class="admin-empty">Aucun produit en base.</td></tr>';
      return;
    }
    productsBody.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${row.name}</td>
            <td>${row.category}</td>
            <td>${Number(row.price_eur).toFixed(2)} EUR</td>
            <td><button class="btn" type="button" data-product-delete data-product-id="${row.id}">Supprimer</button></td>
          </tr>
        `
      )
      .join("");
  }

  function renderThresholdRules(rows) {
    if (!thresholdsBody) return;
    if (!rows.length) {
      thresholdsBody.innerHTML =
        '<tr><td colspan="6" class="admin-empty">Aucune règle pour le moment.</td></tr>';
      return;
    }
    thresholdsBody.innerHTML = rows
      .map((row) => {
        const scopeLabel = row.scope === "personal" ? "Individuelle" : "Globale";
        const visibilityLabel = row.visibility === "public" ? "Publique" : "Admin";
        const statusLabel = row.is_triggered ? "Déclenchée" : "En attente";
        return `
          <tr>
            <td>
              <input
                type="number"
                min="1"
                value="${Number(row.min_orders)}"
                data-threshold-min-orders
                data-threshold-id="${row.id}"
              />
            </td>
            <td>
              <input
                type="text"
                maxlength="180"
                value="${row.label}"
                data-threshold-label
                data-threshold-id="${row.id}"
              />
            </td>
            <td>
              <select data-threshold-scope data-threshold-id="${row.id}">
                <option value="global"${row.scope === "global" ? " selected" : ""}>${scopeLabel}</option>
                <option value="personal"${row.scope === "personal" ? " selected" : ""}>Individuelle</option>
              </select>
            </td>
            <td>
              <select data-threshold-visibility data-threshold-id="${row.id}">
                <option value="admin"${row.visibility === "admin" ? " selected" : ""}>${visibilityLabel}</option>
                <option value="public"${row.visibility === "public" ? " selected" : ""}>Publique</option>
              </select>
            </td>
            <td>${statusLabel}</td>
            <td>
              <button class="btn" type="button" data-threshold-save data-threshold-id="${row.id}">Enregistrer</button>
              <button class="btn" type="button" data-threshold-delete data-threshold-id="${row.id}">Supprimer</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function setFill(fillNode, value) {
    if (!fillNode) return;
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    fillNode.style.width = `${safe}%`;
  }

  function updateVisibilityDashboard(thresholdRows) {
    const target = Number(barometerForm?.target_orders?.value || 0);
    const globalProgress = target > 0 ? (currentOrdersValue / target) * 100 : 0;
    if (globalMetricNode) {
      globalMetricNode.textContent = `${currentOrdersValue} / ${target || "-"}`;
    }
    setFill(globalFillNode, globalProgress);

    const rules = Array.isArray(thresholdRows) ? thresholdRows : [];
    const globalRules = rules.filter((row) => row.scope === "global");
    const globalTriggered = globalRules.filter((row) => row.is_triggered).length;
    const globalRulesRatio = globalRules.length ? (globalTriggered / globalRules.length) * 100 : 0;
    if (rulesGlobalMetricNode) {
      rulesGlobalMetricNode.textContent = `${globalTriggered} / ${globalRules.length} déclenchées`;
    }
    setFill(rulesGlobalFillNode, globalRulesRatio);

    const userRules = rules.filter((row) => row.scope === "personal");
    const userTriggered = userRules.filter((row) => row.is_triggered).length;
    const usersRulesRatio = userRules.length ? (userTriggered / userRules.length) * 100 : 0;
    if (rulesUsersMetricNode) {
      rulesUsersMetricNode.textContent = `${userTriggered} / ${userRules.length} déclenchées`;
    }
    setFill(rulesUsersFillNode, usersRulesRatio);
  }

  function updateBarometerPreview(current, target, milestone) {
    const safeCurrent = Number(current) || 0;
    const safeTarget = Number(target) || 0;
    const progress = safeTarget > 0 ? Math.max(0, Math.min(100, (safeCurrent / safeTarget) * 100)) : 0;

    if (barometerPreviewCount) {
      barometerPreviewCount.innerHTML = `<strong>${safeCurrent}</strong><span class="project-barometer-count-sep">/</span>${safeTarget} commandes`;
    }
    if (barometerPreviewTrack) {
      barometerPreviewTrack.setAttribute("aria-valuenow", String(safeCurrent));
      barometerPreviewTrack.setAttribute("aria-valuemax", String(safeTarget || 100));
    }
    if (barometerPreviewFill) {
      barometerPreviewFill.style.setProperty("--bar-target", `${progress}%`);
    }
    if (barometerPreviewHint) {
      barometerPreviewHint.textContent = `Prochain palier : ${milestone || "-"}`;
    }
  }

  async function loadAccounts() {
    const res = await apiFetch("/rest/v1/profiles?select=id,display_name,role&order=created_at.desc");
    const rows = await res.json();
    renderAccounts(rows);
  }

  async function loadBarometer() {
    const res = await apiFetch("/rest/v1/project_barometer?select=id,current_orders,target_orders,next_milestone&order=id.asc&limit=1");
    const rows = await res.json();
    if (!barometerForm || !rows.length) return;
    const first = rows[0];
    currentOrdersValue = Number(first.current_orders) || 0;
    barometerForm.current_orders.value = first.current_orders;
    barometerForm.target_orders.value = first.target_orders;
    barometerForm.next_milestone.value = first.next_milestone || "";
    updateBarometerPreview(first.current_orders, first.target_orders, first.next_milestone);
  }

  async function loadProducts() {
    const res = await apiFetch("/rest/v1/products?select=id,name,category,price_eur&order=created_at.desc");
    const rows = await res.json();
    renderProducts(rows);
  }

  async function loadThresholdRules() {
    const res = await apiFetch(
      "/rest/v1/admin_threshold_rules?select=id,min_orders,label,scope,visibility,is_triggered,owner_user_id&order=min_orders.asc"
    );
    const rows = await res.json();
    renderThresholdRules(rows);
    updateVisibilityDashboard(rows);
    return rows;
  }

  async function refreshThresholdStatus(currentOrders) {
    const res = await apiFetch(
      "/rest/v1/admin_threshold_rules?select=id,min_orders,scope,owner_user_id"
    );
    const rows = await res.json();
    const updates = rows.map((row) => {
      const isPersonalForCurrentUser =
        row.scope === "personal" && row.owner_user_id === currentUserId;
      const isGlobal = row.scope === "global";
      const shouldEvaluate = isGlobal || isPersonalForCurrentUser;
      return apiFetch(`/rest/v1/admin_threshold_rules?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          is_triggered: shouldEvaluate && Number(currentOrders) >= Number(row.min_orders),
        }),
      });
    });
    await Promise.all(updates);
  }

  async function handleAccountsClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const saveButton = target.closest("[data-role-save]");
    if (!saveButton) return;
    const userId = saveButton.getAttribute("data-user-id");
    const select = document.querySelector(`[data-role-select][data-user-id="${userId}"]`);
    if (!(select instanceof HTMLSelectElement)) return;
    try {
      await apiFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ role: select.value }),
      });
      setStatus("Rôle mis à jour.", false);
      await loadAccounts();
    } catch (err) {
      setStatus(err.message || "Impossible de mettre à jour le rôle.", true);
    }
  }

  async function handleBarometerSubmit(event) {
    event.preventDefault();
    if (!barometerForm) return;
    const current = Number(barometerForm.current_orders.value);
    const target = Number(barometerForm.target_orders.value);
    const milestone = String(barometerForm.next_milestone.value || "").trim();

    if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) {
      setFeedback(barometerFeedback, "Valeurs de baromètre invalides.", true);
      return;
    }
    try {
      await apiFetch("/rest/v1/project_barometer?id=eq.1", {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          current_orders: current,
          target_orders: target,
          next_milestone: milestone,
        }),
      });
      currentOrdersValue = current;
      updateBarometerPreview(current, target, milestone);
      await refreshThresholdStatus(current);
      await loadThresholdRules();
      setFeedback(barometerFeedback, "Baromètre enregistré.", false);
    } catch (err) {
      setFeedback(barometerFeedback, err.message || "Erreur lors de la sauvegarde.", true);
    }
  }

  async function handleThresholdSubmit(event) {
    event.preventDefault();
    if (!thresholdForm) return;
    const minOrders = Number(thresholdForm.min_orders.value);
    const label = String(thresholdForm.label.value || "").trim();
    const scope = String(thresholdForm.scope.value || "global");
    const visibility = String(thresholdForm.visibility.value || "admin");
    if (!Number.isFinite(minOrders) || minOrders <= 0 || !label) {
      setFeedback(thresholdFeedback, "Règle invalide.", true);
      return;
    }
    try {
      await apiFetch("/rest/v1/admin_threshold_rules", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          min_orders: minOrders,
          label,
          scope,
          visibility,
          owner_user_id: scope === "personal" ? currentUserId : null,
          is_triggered: Number(currentOrdersValue) >= minOrders,
        }),
      });
      thresholdForm.reset();
      await loadThresholdRules();
      setFeedback(thresholdFeedback, "Règle ajoutée.", false);
    } catch (err) {
      setFeedback(thresholdFeedback, err.message || "Impossible d'ajouter la règle.", true);
    }
  }

  async function handleProductSubmit(event) {
    event.preventDefault();
    if (!productForm) return;
    const name = String(productForm.name.value || "").trim();
    const category = String(productForm.category.value || "").trim();
    const price = Number(productForm.price_eur.value);
    if (!name || !category || !Number.isFinite(price) || price < 0) {
      setFeedback(productsFeedback, "Données produit invalides.", true);
      return;
    }
    try {
      await apiFetch("/rest/v1/products", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          name,
          category,
          price_eur: price,
          is_active: true,
        }),
      });
      productForm.reset();
      setFeedback(productsFeedback, "Produit ajouté.", false);
      await loadProducts();
    } catch (err) {
      setFeedback(productsFeedback, err.message || "Impossible d'ajouter le produit.", true);
    }
  }

  async function handleProductsClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const deleteButton = target.closest("[data-product-delete]");
    if (!deleteButton) return;
    const productId = deleteButton.getAttribute("data-product-id");
    if (!productId) return;
    try {
      await apiFetch(`/rest/v1/products?id=eq.${encodeURIComponent(productId)}`, {
        method: "DELETE",
      });
      setFeedback(productsFeedback, "Produit supprimé.", false);
      await loadProducts();
    } catch (err) {
      setFeedback(productsFeedback, err.message || "Impossible de supprimer le produit.", true);
    }
  }

  async function handleThresholdsClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const saveButton = target.closest("[data-threshold-save]");
    if (saveButton) {
      const thresholdId = saveButton.getAttribute("data-threshold-id");
      if (!thresholdId) return;
      const minOrdersInput = document.querySelector(
        `[data-threshold-min-orders][data-threshold-id="${thresholdId}"]`
      );
      const labelInput = document.querySelector(
        `[data-threshold-label][data-threshold-id="${thresholdId}"]`
      );
      const scopeSelect = document.querySelector(
        `[data-threshold-scope][data-threshold-id="${thresholdId}"]`
      );
      const visibilitySelect = document.querySelector(
        `[data-threshold-visibility][data-threshold-id="${thresholdId}"]`
      );
      if (
        !(minOrdersInput instanceof HTMLInputElement) ||
        !(labelInput instanceof HTMLInputElement) ||
        !(scopeSelect instanceof HTMLSelectElement) ||
        !(visibilitySelect instanceof HTMLSelectElement)
      ) {
        return;
      }
      const minOrders = Number(minOrdersInput.value);
      const label = String(labelInput.value || "").trim();
      const scope = String(scopeSelect.value || "global");
      const visibility = String(visibilitySelect.value || "admin");
      if (!Number.isFinite(minOrders) || minOrders <= 0 || !label) {
        setFeedback(thresholdFeedback, "Valeurs de regle invalides.", true);
        return;
      }
      try {
        await apiFetch(`/rest/v1/admin_threshold_rules?id=eq.${encodeURIComponent(thresholdId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            min_orders: minOrders,
            label,
            scope,
            visibility,
            owner_user_id: scope === "personal" ? currentUserId : null,
            is_triggered: Number(currentOrdersValue) >= minOrders,
          }),
        });
        await loadThresholdRules();
        setFeedback(thresholdFeedback, "Regle mise a jour.", false);
      } catch (err) {
        setFeedback(thresholdFeedback, err.message || "Impossible de modifier la regle.", true);
      }
      return;
    }

    const deleteButton = target.closest("[data-threshold-delete]");
    if (!deleteButton) return;
    const thresholdId = deleteButton.getAttribute("data-threshold-id");
    if (!thresholdId) return;
    try {
      await apiFetch(`/rest/v1/admin_threshold_rules?id=eq.${encodeURIComponent(thresholdId)}`, {
        method: "DELETE",
      });
      await loadThresholdRules();
      setFeedback(thresholdFeedback, "Règle supprimée.", false);
    } catch (err) {
      setFeedback(thresholdFeedback, err.message || "Impossible de supprimer la règle.", true);
    }
  }

  async function initAdminPage() {
    const session = window.BLAuthUi?.getStoredSession?.();
    accessToken = session && session.access_token;
    if (!accessToken) {
      setStatus("Connecte-toi d'abord pour accéder à l'espace admin.", true);
      return;
    }

    const payload = window.BLAuthUi?.parseJwtPayload?.(accessToken);
    const userId = payload && payload.sub;
    currentUserId = userId || "";
    if (!userId) {
      setStatus("Session invalide. Reconnecte-toi.", true);
      return;
    }

    const role = await window.BLAuthUi?.fetchCurrentRole?.(accessToken, userId);
    if (!role) {
      setStatus(
        "Profil introuvable côté base (table profiles). Exécute le SQL de bootstrap admin puis reconnecte-toi.",
        true
      );
      return;
    }

    if (role !== "admin") {
      setStatus("Accès refusé : ce compte n'a pas le rôle admin.", true);
      return;
    }

    setStatus("Connexion admin valide.", false);
    if (accountsSection) accountsSection.hidden = false;
    if (barometerSection) barometerSection.hidden = false;
    if (productsSection) productsSection.hidden = false;

    accountsBody?.addEventListener("click", handleAccountsClick);
    productsBody?.addEventListener("click", handleProductsClick);
    thresholdsBody?.addEventListener("click", handleThresholdsClick);
    barometerForm?.addEventListener("submit", handleBarometerSubmit);
    thresholdForm?.addEventListener("submit", handleThresholdSubmit);
    productForm?.addEventListener("submit", handleProductSubmit);

    await Promise.all([loadAccounts(), loadBarometer(), loadProducts()]);
    await refreshThresholdStatus(currentOrdersValue);
    const thresholdRows = await loadThresholdRules();
    updateVisibilityDashboard(thresholdRows);
  }

  initAdminPage();
})();
