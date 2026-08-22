(function () {
  const statusNode = document.getElementById("admin-status");
  const servicesNav = document.getElementById("admin-services-nav");
  const accountsSection = document.getElementById("admin-accounts-section");
  const accountsBody = document.getElementById("admin-accounts-body");
  const barometerSection = document.getElementById("admin-barometer-section");
  const barometerForm = document.getElementById("admin-barometer-form");
  const barometerFeedback = document.getElementById("admin-barometer-feedback");
  const thresholdForm = document.getElementById("admin-threshold-form");
  const thresholdFeedback = document.getElementById("admin-threshold-feedback");
  const thresholdsBody = document.getElementById("admin-thresholds-body");
  const userBarometerForm = document.getElementById("admin-user-barometer-form");
  const userBarometerFeedback = document.getElementById("admin-user-barometer-feedback");
  const userBarometersBody = document.getElementById("admin-user-barometers-body");
  const userProgressResetForm = document.getElementById("admin-user-progress-reset-form");
  const userProgressResetFeedback = document.getElementById("admin-user-progress-reset-feedback");
  const resetUserSelect = document.getElementById("admin-reset-user-id");
  const resetTemplateSelect = document.getElementById("admin-reset-template-id");
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
  const productCategorySelect = document.getElementById("product-category");
  const requestsSection = document.getElementById("admin-requests-section");
  const requestsBody = document.getElementById("admin-requests-body");
  const requestsFeedback = document.getElementById("admin-requests-feedback");
  const requestsSearch = document.getElementById("admin-request-search");
  const requestsStatusFilter = document.getElementById("admin-request-status-filter");
  const requestsReset = document.getElementById("admin-request-reset");
  const requestsResultsMeta = document.getElementById("admin-request-results-meta");
  const requestsCountAll = document.getElementById("admin-request-count-all");
  const requestsCountNew = document.getElementById("admin-request-count-new");
  const requestsCountProgress = document.getElementById("admin-request-count-progress");
  const requestsCountConfirmed = document.getElementById("admin-request-count-confirmed");
  const hasAccountsModule = Boolean(accountsSection && accountsBody);
  const hasBarometerModule = Boolean(barometerSection && barometerForm);
  const hasProductsModule = Boolean(productsSection && productsBody && productForm);
  const hasRequestsModule = Boolean(requestsSection && requestsBody);
  const defaultProductCategories = ["tcg", "jeux-societe", "classiques-puzzle-echecs"];
  const requestStatuses = [
    ["new", "Nouvelle"],
    ["in_progress", "En cours"],
    ["validated", "Validée"],
    ["declined", "Refusée"],
    ["completed", "Terminée"],
  ];
  const requestCategoryLabels = {
    tcg: "Jeux de cartes à collectionner",
    "jeux-societe": "Jeux de société",
    "classiques-puzzle-echecs": "Classiques, puzzle et échecs",
    "idee-cadeau": "Idée cadeau / conseil",
    autre: "Autre demande",
  };
  const adminServices = [
    {
      page: "admin-comptes.html",
      title: "Comptes utilisateurs",
      description: "Modifier les rôles et gérer les accès.",
    },
    {
      page: "admin-barometre.html",
      title: "Baromètre",
      description: "Piloter les commandes et les règles de seuil.",
    },
    {
      page: "admin-produits.html",
      title: "Produits",
      description: "Ajouter ou supprimer des produits du catalogue.",
    },
    {
      page: "admin-demandes.html",
      title: "Demandes de commande",
      description: "Suivre les demandes, statuts et notes de traitement.",
    },
  ];
  const recentLoginStorageKey = "bl_recent_login_at";
  const recentLoginMaxAgeMs = 2 * 60 * 1000;
  const loginNoticeDurationMs = 4000;
  let accessToken = "";
  let currentUserId = "";
  let currentOrdersValue = 0;
  let supportsAdvancedProductFields = true;
  let currentOrderRequests = [];

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

  function renderAdminServicesNav() {
    if (!servicesNav) return;

    const currentPage = window.location.pathname.split("/").pop() || "admin.html";
    const shortcuts = adminServices
      .map((service) => {
        const isCurrent = service.page === currentPage;
        const activeClass = isCurrent ? " admin-shortcut-card--active" : "";
        const currentAttribute = isCurrent ? ' aria-current="page"' : "";
        return `
          <a class="admin-shortcut-card${activeClass}" href="./${service.page}"${currentAttribute}>
            <h3>${service.title}</h3>
            <p>${service.description}</p>
          </a>`;
      })
      .join("");

    servicesNav.innerHTML = `
      <h2><a href="./admin.html">Services principaux</a></h2>
      <div class="admin-shortcuts">${shortcuts}</div>`;
  }

  function showRecentLoginNotice() {
    const rawLoginTime = sessionStorage.getItem(recentLoginStorageKey);
    sessionStorage.removeItem(recentLoginStorageKey);

    const loginTime = Number(rawLoginTime);
    const noticeIsRecent =
      Number.isFinite(loginTime) &&
      loginTime > 0 &&
      Date.now() >= loginTime &&
      Date.now() - loginTime <= recentLoginMaxAgeMs;

    if (!noticeIsRecent) {
      setStatus("", false);
      return;
    }

    setStatus("Connexion admin valide.", false);
    window.setTimeout(() => {
      if (statusNode?.textContent === "Connexion admin valide.") {
        setStatus("", false);
      }
    }, loginNoticeDurationMs);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function renderRequestStatusOptions(currentStatus) {
    return requestStatuses
      .map(([value, label]) => `<option value="${value}"${value === currentStatus ? " selected" : ""}>${label}</option>`)
      .join("");
  }

  function getRequestStatusLabel(status) {
    return requestStatuses.find(([value]) => value === status)?.[1] || "Nouvelle";
  }

  function normalizeRequestSearch(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function updateOrderRequestSummary(rows) {
    const totals = rows.reduce(
      (summary, row) => {
        summary.all += 1;
        if (row.status === "new") summary.new += 1;
        if (row.status === "in_progress") summary.progress += 1;
        if (row.status === "validated" || row.status === "completed") summary.confirmed += 1;
        return summary;
      },
      { all: 0, new: 0, progress: 0, confirmed: 0 }
    );

    if (requestsCountAll) requestsCountAll.textContent = String(totals.all);
    if (requestsCountNew) requestsCountNew.textContent = String(totals.new);
    if (requestsCountProgress) requestsCountProgress.textContent = String(totals.progress);
    if (requestsCountConfirmed) requestsCountConfirmed.textContent = String(totals.confirmed);
  }

  function filterOrderRequests(rows) {
    const search = normalizeRequestSearch(
      requestsSearch instanceof HTMLInputElement ? requestsSearch.value : ""
    );
    const selectedStatus =
      requestsStatusFilter instanceof HTMLSelectElement ? requestsStatusFilter.value : "all";

    return rows.filter((row) => {
      if (selectedStatus !== "all" && row.status !== selectedStatus) return false;
      if (!search) return true;

      const searchableText = normalizeRequestSearch(
        [
          row.customer_name,
          row.customer_email,
          row.linked_user_id,
          row.category,
          requestCategoryLabels[row.category],
          row.product_name,
          row.details,
          row.pickup_notes,
          row.admin_notes,
          getRequestStatusLabel(row.status),
        ].join(" ")
      );
      return searchableText.includes(search);
    });
  }

  function applyOrderRequestFilters() {
    const filteredRows = filterOrderRequests(currentOrderRequests);
    renderOrderRequests(filteredRows);
    if (!requestsResultsMeta) return;

    if (!currentOrderRequests.length) {
      requestsResultsMeta.textContent = "Aucune demande reçue pour le moment.";
      return;
    }
    const suffix = filteredRows.length === 1 ? "" : "s";
    requestsResultsMeta.textContent = `${filteredRows.length} demande${suffix} affichée${suffix} sur ${currentOrderRequests.length}.`;
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
        '<tr><td colspan="6" class="admin-empty">Aucun produit en base.</td></tr>';
      return;
    }
    productsBody.innerHTML = rows
      .map((row) => {
        const ageMin = Number.isFinite(Number(row.age_min)) ? Number(row.age_min) : null;
        const ageMax = Number.isFinite(Number(row.age_max)) ? Number(row.age_max) : null;
        let ageLabel = "-";
        if (ageMin !== null && ageMax !== null) ageLabel = `${ageMin} - ${ageMax} ans`;
        else if (ageMin !== null) ageLabel = `${ageMin}+ ans`;
        else if (ageMax !== null) ageLabel = `jusqu'à ${ageMax} ans`;
        const mediaLinks = [];
        if (row.image_url) {
          mediaLinks.push(
            `<a class="admin-media-link" href="${row.image_url}" target="_blank" rel="noopener noreferrer">Photo</a>`
          );
        }
        if (row.video_url) {
          mediaLinks.push(
            `<a class="admin-media-link" href="${row.video_url}" target="_blank" rel="noopener noreferrer">Vidéo</a>`
          );
        }
        return `
          <tr>
            <td>${row.name}</td>
            <td>${row.category}</td>
            <td>${Number(row.price_eur).toFixed(2)} EUR</td>
            <td>${ageLabel}</td>
            <td>${mediaLinks.join(" · ") || "-"}</td>
            <td><button class="btn" type="button" data-product-delete data-product-id="${row.id}">Supprimer</button></td>
          </tr>
        `;
      })
      .join("");
  }

  function renderOrderRequests(rows) {
    if (!requestsBody) return;
    if (!rows.length) {
      requestsBody.innerHTML =
        `<tr><td colspan="8" class="admin-empty">${
          currentOrderRequests.length
            ? "Aucune demande ne correspond aux filtres."
            : "Aucune demande de commande pour le moment."
        }</td></tr>`;
      return;
    }

    requestsBody.innerHTML = rows
      .map((row) => {
        const requestId = escapeHtml(row.id);
        const safeStatus = requestStatuses.some(([value]) => value === row.status) ? row.status : "new";
        const statusLabel = getRequestStatusLabel(safeStatus);
        const mailSubject = encodeURIComponent(`Demande Bouguenais Ludique - ${row.product_name || "commande"}`);
        const mailBody = encodeURIComponent(
          `Bonjour ${row.customer_name || ""},

Je reviens vers vous au sujet de votre demande : ${row.product_name || ""}.

Je vous confirme les possibilités, le prix et le délai dès que possible.

Bien cordialement,
Bouguenais Ludique
`
        );
        const mailHref = `mailto:${encodeURIComponent(row.customer_email || "")}?subject=${mailSubject}&body=${mailBody}`;
        const playerAge = Number.isFinite(Number(row.player_age)) ? `${Number(row.player_age)} ans` : "-";
        const budget = Number.isFinite(Number(row.budget_eur)) ? `${Number(row.budget_eur).toFixed(2)} EUR` : "-";
        const categoryLabel = requestCategoryLabels[row.category] || row.category || "-";
        const confirmedOrderCount = Number.isFinite(Number(row.confirmed_order_count))
          ? Math.max(0, Number(row.confirmed_order_count))
          : 0;
        const hasLinkedAccount = Boolean(row.linked_user_id);
        const isCredited = safeStatus === "validated" || safeStatus === "completed";
        const accountLinkLabel = hasLinkedAccount ? "Compte client lié" : "Aucun compte correspondant";
        return `
          <tr data-order-request-row="${requestId}">
            <td data-label="Reçue le">
              <time datetime="${escapeHtml(row.created_at || "")}">${formatDateTime(row.created_at)}</time>
            </td>
            <td data-label="Demandeur">
              <strong>${escapeHtml(row.customer_name)}</strong><br />
              <a class="admin-media-link" href="${mailHref}">${escapeHtml(row.customer_email)}</a><br />
              <span class="admin-request-account admin-request-account--${hasLinkedAccount ? "linked" : "missing"}">${accountLinkLabel}</span>
              ${!hasLinkedAccount && isCredited && confirmedOrderCount > 0 ? '<small class="admin-request-account-warning">La quantité compte au global, mais pas encore dans l’espace client.</small>' : ""}
            </td>
            <td data-label="Demande">
              <strong>${escapeHtml(row.product_name)}</strong><br />
              <span>${escapeHtml(categoryLabel)}</span><br />
              <small>Âge : ${escapeHtml(playerAge)} · Budget : ${escapeHtml(budget)}</small>
            </td>
            <td class="admin-request-details" data-label="Détails">
              ${escapeHtml(row.details)}
              ${row.pickup_notes ? `<br /><small>Retrait : ${escapeHtml(row.pickup_notes)}</small>` : ""}
            </td>
            <td data-label="Statut">
              <span class="admin-request-status-badge admin-request-status-badge--${safeStatus}">${statusLabel}</span>
              <select class="admin-request-status" aria-label="Statut de ${escapeHtml(row.product_name)}" data-order-request-status data-order-request-id="${requestId}">
                ${renderRequestStatusOptions(safeStatus)}
              </select>
            </td>
            <td data-label="Quantité validée">
              <input
                class="admin-request-count"
                type="number"
                min="0"
                step="1"
                value="${confirmedOrderCount}"
                aria-label="Quantité validée pour ${escapeHtml(row.product_name)}"
                data-order-request-count
                data-order-request-id="${requestId}"
              />
            </td>
            <td class="admin-request-notes" data-label="Notes admin">
              <textarea aria-label="Notes admin pour ${escapeHtml(row.product_name)}" maxlength="1000" data-order-request-notes data-order-request-id="${requestId}">${escapeHtml(row.admin_notes || "")}</textarea>
            </td>
            <td class="admin-request-actions" data-label="Actions">
              <a class="btn btn-secondary admin-request-reply" href="${mailHref}">Répondre</a>
              <button class="btn" type="button" data-order-request-save data-order-request-id="${requestId}">Enregistrer</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderProductCategoryOptions(rows) {
    if (!(productCategorySelect instanceof HTMLSelectElement)) return;
    let categories = Array.from(
      new Set(
        rows
          .map((row) => String(row.category || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "fr"));
    if (!categories.length) {
      categories = [...defaultProductCategories];
    }
    const previousValue = productCategorySelect.value;
    productCategorySelect.innerHTML = ['<option value="" disabled>Choisir une catégorie</option>'].concat(
      categories.map((category) => `<option value="${category}">${category}</option>`)
    ).join("");
    productCategorySelect.disabled = false;
    if (previousValue && categories.includes(previousValue)) {
      productCategorySelect.value = previousValue;
    } else {
      productCategorySelect.value = "";
    }
  }

  function readOptionalNumber(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
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

  function renderUserBarometers(rows) {
    if (!userBarometersBody) return;
    if (!rows.length) {
      userBarometersBody.innerHTML =
        '<tr><td colspan="7" class="admin-empty">Aucun baromètre utilisateur configuré.</td></tr>';
      return;
    }
    userBarometersBody.innerHTML = rows
      .map(
        (row) => {
          const modeLabel =
            row.progression_mode === "one_time_unlock"
              ? "Déblocage unique à vie"
              : "Reset automatique";
          return `
          <tr>
            <td>${row.title}</td>
            <td>${Number(row.target_value)}</td>
            <td>${modeLabel}</td>
            <td>${row.reward_text}</td>
            <td>${row.game_category || "-"}</td>
            <td>
              <select data-user-barometer-active data-user-barometer-id="${row.id}">
                <option value="true"${row.is_active ? " selected" : ""}>Oui</option>
                <option value="false"${!row.is_active ? " selected" : ""}>Non</option>
              </select>
            </td>
            <td>
              <button class="btn" type="button" data-user-barometer-save data-user-barometer-id="${row.id}">Enregistrer</button>
              <button class="btn" type="button" data-user-barometer-delete data-user-barometer-id="${row.id}">Supprimer</button>
            </td>
          </tr>
        `;
        }
      )
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
    renderResetUserOptions(rows);
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

  async function loadOrderRequests() {
    const res = await apiFetch(
      "/rest/v1/order_requests?select=id,customer_name,customer_email,category,product_name,player_age,budget_eur,details,pickup_notes,status,confirmed_order_count,linked_user_id,admin_notes,created_at,updated_at&order=created_at.desc"
    );
    const rows = await res.json();
    currentOrderRequests = Array.isArray(rows) ? rows : [];
    updateOrderRequestSummary(currentOrderRequests);
    applyOrderRequestFilters();
  }

  async function loadProducts() {
    let rows = [];
    if (supportsAdvancedProductFields) {
      try {
        const res = await apiFetch(
          "/rest/v1/products?select=id,name,category,price_eur,age_min,age_max,image_url,video_url&order=created_at.desc"
        );
        rows = await res.json();
      } catch (err) {
        supportsAdvancedProductFields = false;
        setFeedback(
          productsFeedback,
          "Les nouveaux champs produits ne sont pas encore actifs en base. Exécute le SQL de migration dans supabase/schema.sql.",
          true
        );
      }
    }
    if (!supportsAdvancedProductFields) {
      const res = await apiFetch("/rest/v1/products?select=id,name,category,price_eur&order=created_at.desc");
      rows = await res.json();
    }
    renderProductCategoryOptions(rows);
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

  async function loadUserBarometers() {
    if (!userBarometersBody) return [];
    const res = await apiFetch(
      "/rest/v1/user_barometer_templates?select=id,title,target_value,progression_mode,reward_text,game_category,is_active&order=created_at.desc"
    );
    const rows = await res.json();
    renderUserBarometers(rows);
    renderResetTemplateOptions(rows);
    return rows;
  }

  function renderResetUserOptions(rows) {
    if (!(resetUserSelect instanceof HTMLSelectElement)) return;
    const base = '<option value="" selected disabled>Choisir un utilisateur</option>';
    if (!Array.isArray(rows) || rows.length === 0) {
      resetUserSelect.innerHTML = `${base}<option value="" disabled>Aucun utilisateur</option>`;
      return;
    }
    resetUserSelect.innerHTML = base
      .concat(
        rows.map((row) => {
          const label = row.display_name ? `${row.display_name} (${row.id})` : row.id;
          return `<option value="${row.id}">${label}</option>`;
        })
      )
      .join("");
  }

  function renderResetTemplateOptions(rows) {
    if (!(resetTemplateSelect instanceof HTMLSelectElement)) return;
    const base = '<option value="" selected disabled>Choisir un baromètre</option>';
    if (!Array.isArray(rows) || rows.length === 0) {
      resetTemplateSelect.innerHTML = `${base}<option value="" disabled>Aucun baromètre</option>`;
      return;
    }
    resetTemplateSelect.innerHTML = base
      .concat(
        rows.map(
          (row) =>
            `<option value="${row.id}">${row.title} (${Number(row.target_value) || 0})</option>`
        )
      )
      .join("");
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

  async function handleUserBarometerSubmit(event) {
    event.preventDefault();
    if (!userBarometerForm) return;
    const title = String(userBarometerForm.title.value || "").trim();
    const targetValue = Number(userBarometerForm.target_value.value);
    const progressionMode = String(userBarometerForm.progression_mode.value || "repeatable_reset");
    const rewardText = String(userBarometerForm.reward_text.value || "").trim();
    const gameCategory = String(userBarometerForm.game_category.value || "").trim();
    const description = String(userBarometerForm.description.value || "").trim();
    if (!title || !rewardText || !Number.isFinite(targetValue) || targetValue <= 0) {
      setFeedback(userBarometerFeedback, "Baromètre utilisateur invalide.", true);
      return;
    }
    try {
      await apiFetch("/rest/v1/user_barometer_templates", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          title,
          target_value: targetValue,
          progression_mode: progressionMode,
          reward_text: rewardText,
          game_category: gameCategory || null,
          description: description || null,
          is_active: true,
        }),
      });
      userBarometerForm.reset();
      await loadUserBarometers();
      setFeedback(userBarometerFeedback, "Baromètre utilisateur ajouté.", false);
    } catch (err) {
      setFeedback(
        userBarometerFeedback,
        err.message || "Impossible d'ajouter le baromètre utilisateur.",
        true
      );
    }
  }

  async function handleUserProgressResetSubmit(event) {
    event.preventDefault();
    if (!userProgressResetForm) return;
    const userId = String(userProgressResetForm.user_id.value || "").trim();
    const templateId = Number(userProgressResetForm.template_id.value);
    if (!userId || !Number.isFinite(templateId) || templateId <= 0) {
      setFeedback(userProgressResetFeedback, "Sélection utilisateur/baromètre invalide.", true);
      return;
    }
    try {
      await apiFetch("/rest/v1/user_barometer_progress", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          user_id: userId,
          template_id: templateId,
          current_value: 0,
          completed_count: 0,
          unlocked_at: null,
          updated_at: new Date().toISOString(),
        }),
      });
      setFeedback(userProgressResetFeedback, "Progression réinitialisée.", false);
    } catch (err) {
      setFeedback(
        userProgressResetFeedback,
        err.message || "Impossible de réinitialiser la progression.",
        true
      );
    }
  }

  async function handleProductSubmit(event) {
    event.preventDefault();
    if (!productForm) return;
    const name = String(productForm.name.value || "").trim();
    const category = String(productForm.category.value || "").trim();
    const price = Number(productForm.price_eur.value);
    const ageMin = readOptionalNumber(productForm.age_min?.value);
    const ageMax = readOptionalNumber(productForm.age_max?.value);
    const imageUrl = String(productForm.image_url?.value || "").trim();
    const videoUrl = String(productForm.video_url?.value || "").trim();

    if (
      !name ||
      !category ||
      !Number.isFinite(price) ||
      price < 0 ||
      Number.isNaN(ageMin) ||
      Number.isNaN(ageMax)
    ) {
      setFeedback(productsFeedback, "Données produit invalides.", true);
      return;
    }
    if (ageMin !== null && ageMin < 0) {
      setFeedback(productsFeedback, "Âge minimum invalide.", true);
      return;
    }
    if (ageMax !== null && ageMax < 0) {
      setFeedback(productsFeedback, "Âge maximum invalide.", true);
      return;
    }
    if (ageMin !== null && ageMax !== null && ageMax < ageMin) {
      setFeedback(productsFeedback, "L'âge maximum doit être supérieur ou égal à l'âge minimum.", true);
      return;
    }
    try {
      const payload = {
        name,
        category,
        price_eur: price,
        is_active: true,
      };
      if (supportsAdvancedProductFields) {
        payload.age_min = ageMin;
        payload.age_max = ageMax;
        payload.image_url = imageUrl || null;
        payload.video_url = videoUrl || null;
      }
      await apiFetch("/rest/v1/products", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
      productForm.reset();
      if (productCategorySelect instanceof HTMLSelectElement) {
        productCategorySelect.value = "";
      }
      setFeedback(productsFeedback, "Produit ajouté.", false);
      await loadProducts();
    } catch (err) {
      setFeedback(productsFeedback, err.message || "Impossible d'ajouter le produit.", true);
    }
  }

  async function handleOrderRequestsClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const saveButton = target.closest("[data-order-request-save]");
    if (!saveButton) return;

    const requestId = saveButton.getAttribute("data-order-request-id");
    if (!requestId || !requestsBody) return;

    const statusField = requestsBody.querySelector(`[data-order-request-status][data-order-request-id="${requestId}"]`);
    const notesField = requestsBody.querySelector(`[data-order-request-notes][data-order-request-id="${requestId}"]`);
    const countField = requestsBody.querySelector(`[data-order-request-count][data-order-request-id="${requestId}"]`);
    const status = statusField instanceof HTMLSelectElement ? statusField.value : "new";
    const adminNotes = notesField instanceof HTMLTextAreaElement ? notesField.value.trim() : "";
    const confirmedOrderCount = countField instanceof HTMLInputElement ? Number(countField.value) : 0;
    const requestRow = currentOrderRequests.find((row) => String(row.id) === String(requestId));

    if (!requestStatuses.some(([value]) => value === status)) {
      setFeedback(requestsFeedback, "Statut de demande invalide.", true);
      return;
    }
    if (!Number.isInteger(confirmedOrderCount) || confirmedOrderCount < 0) {
      setFeedback(requestsFeedback, "Le nombre de commandes comptées doit être un entier positif ou nul.", true);
      return;
    }

    const originalButtonLabel = saveButton.textContent;
    if (saveButton instanceof HTMLButtonElement) {
      saveButton.disabled = true;
      saveButton.textContent = "Enregistrement…";
    }
    try {
      await apiFetch(`/rest/v1/order_requests?id=eq.${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status,
          confirmed_order_count: confirmedOrderCount,
          admin_notes: adminNotes || null,
          updated_at: new Date().toISOString(),
        }),
      });
      const creditsCustomer =
        confirmedOrderCount > 0 && (status === "validated" || status === "completed");
      const feedbackMessage =
        creditsCustomer && !requestRow?.linked_user_id
          ? "Demande mise à jour. La quantité compte au global ; elle apparaîtra chez le client dès qu'un compte utilisera cet e-mail."
          : creditsCustomer
            ? "Demande mise à jour et quantité créditée au compte client."
            : "Demande mise à jour.";
      setFeedback(requestsFeedback, feedbackMessage, false);
      await loadOrderRequests();
    } catch (err) {
      setFeedback(requestsFeedback, err.message || "Impossible de mettre à jour la demande.", true);
    } finally {
      if (saveButton instanceof HTMLButtonElement && saveButton.isConnected) {
        saveButton.disabled = false;
        saveButton.textContent = originalButtonLabel;
      }
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

  async function handleUserBarometersClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const saveButton = target.closest("[data-user-barometer-save]");
    if (saveButton) {
      const id = saveButton.getAttribute("data-user-barometer-id");
      if (!id) return;
      const activeSelect = document.querySelector(
        `[data-user-barometer-active][data-user-barometer-id="${id}"]`
      );
      if (!(activeSelect instanceof HTMLSelectElement)) return;
      try {
        await apiFetch(`/rest/v1/user_barometer_templates?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            is_active: activeSelect.value === "true",
          }),
        });
        await loadUserBarometers();
        setFeedback(userBarometerFeedback, "Baromètre utilisateur mis à jour.", false);
      } catch (err) {
        setFeedback(
          userBarometerFeedback,
          err.message || "Impossible de mettre à jour ce baromètre utilisateur.",
          true
        );
      }
      return;
    }

    const deleteButton = target.closest("[data-user-barometer-delete]");
    if (!deleteButton) return;
    const id = deleteButton.getAttribute("data-user-barometer-id");
    if (!id) return;
    try {
      await apiFetch(`/rest/v1/user_barometer_templates?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await loadUserBarometers();
      setFeedback(userBarometerFeedback, "Baromètre utilisateur supprimé.", false);
    } catch (err) {
      setFeedback(
        userBarometerFeedback,
        err.message || "Impossible de supprimer ce baromètre utilisateur.",
        true
      );
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

    showRecentLoginNotice();
    renderAdminServicesNav();
    if (servicesNav) servicesNav.hidden = false;
    if (hasAccountsModule && accountsSection) accountsSection.hidden = false;
    if (hasBarometerModule && barometerSection) barometerSection.hidden = false;
    if (hasProductsModule && productsSection) productsSection.hidden = false;
    if (hasRequestsModule && requestsSection) requestsSection.hidden = false;

    if (hasAccountsModule) {
      accountsBody?.addEventListener("click", handleAccountsClick);
    }
    if (hasProductsModule) {
      productsBody?.addEventListener("click", handleProductsClick);
      productForm?.addEventListener("submit", handleProductSubmit);
    }
    if (hasRequestsModule) {
      requestsBody?.addEventListener("click", handleOrderRequestsClick);
      requestsSearch?.addEventListener("input", applyOrderRequestFilters);
      requestsStatusFilter?.addEventListener("change", applyOrderRequestFilters);
      requestsReset?.addEventListener("click", () => {
        if (requestsSearch instanceof HTMLInputElement) requestsSearch.value = "";
        if (requestsStatusFilter instanceof HTMLSelectElement) requestsStatusFilter.value = "all";
        applyOrderRequestFilters();
        requestsSearch?.focus();
      });
    }
    if (hasBarometerModule) {
      thresholdsBody?.addEventListener("click", handleThresholdsClick);
      barometerForm?.addEventListener("submit", handleBarometerSubmit);
      thresholdForm?.addEventListener("submit", handleThresholdSubmit);
      userBarometerForm?.addEventListener("submit", handleUserBarometerSubmit);
      userProgressResetForm?.addEventListener("submit", handleUserProgressResetSubmit);
      userBarometersBody?.addEventListener("click", handleUserBarometersClick);
    }

    const loadingTasks = [];
    if (hasAccountsModule) loadingTasks.push(loadAccounts());
    if (hasBarometerModule) loadingTasks.push(loadBarometer());
    if (hasProductsModule) loadingTasks.push(loadProducts());
    if (hasRequestsModule) loadingTasks.push(loadOrderRequests());
    await Promise.all(loadingTasks);

    if (hasBarometerModule) {
      await refreshThresholdStatus(currentOrdersValue);
      const thresholdRows = await loadThresholdRules();
      updateVisibilityDashboard(thresholdRows);
      await loadUserBarometers();
    }
  }

  initAdminPage();
})();
