(function () {
  const statusNode = document.getElementById("space-status");
  const ordersBody = document.getElementById("space-orders-body");
  const ordersMeta = document.getElementById("space-orders-meta");
  const globalCountNode = document.getElementById("space-global-count");
  const personalCountNode = document.getElementById("space-personal-count");
  const globalFillNode = document.getElementById("space-global-fill");
  const personalFillNode = document.getElementById("space-personal-fill");

  const statusLabels = {
    new: "Nouvelle",
    in_progress: "En cours",
    validated: "Validée",
    declined: "Refusée",
    completed: "Terminée",
  };
  const categoryLabels = {
    tcg: "Jeux de cartes à collectionner",
    "jeux-societe": "Jeux de société",
    "classiques-puzzle-echecs": "Classiques, puzzle et échecs",
    "idee-cadeau": "Idée cadeau / conseil",
    autre: "Autre demande",
  };

  let accessToken = "";
  let globalTarget = 0;
  let globalCurrent = 0;
  let personalCurrent = 0;

  function setStatus(message, isError) {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.classList.toggle("form-feedback--error", Boolean(isError));
    statusNode.hidden = !message;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
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

  function renderOrders(rows) {
    if (!ordersBody) return;
    if (!rows.length) {
      ordersBody.innerHTML =
        '<tr><td colspan="5" class="admin-empty">Aucune demande liée à ce compte pour le moment.</td></tr>';
      if (ordersMeta) ordersMeta.textContent = "Aucune demande retrouvée.";
      return;
    }

    ordersBody.innerHTML = rows
      .map((row) => {
        const safeStatus = Object.hasOwn(statusLabels, row.status) ? row.status : "new";
        const statusLabel = statusLabels[safeStatus];
        const categoryLabel = categoryLabels[row.category] || row.category || "-";
        const isConfirmed = safeStatus === "validated" || safeStatus === "completed";
        const confirmedCount = isConfirmed
          ? Math.max(0, Number(row.confirmed_order_count) || 0)
          : null;
        return `
          <tr>
            <td data-label="Date"><time datetime="${escapeHtml(row.created_at || "")}">${formatDate(row.created_at)}</time></td>
            <td data-label="Jeu ou produit"><strong>${escapeHtml(row.product_name || "-")}</strong></td>
            <td data-label="Catégorie">${escapeHtml(categoryLabel)}</td>
            <td data-label="Statut"><span class="admin-request-status-badge admin-request-status-badge--${safeStatus}">${statusLabel}</span></td>
            <td data-label="Quantité validée">${confirmedCount === null ? "—" : escapeHtml(confirmedCount)}</td>
          </tr>
        `;
      })
      .join("");

    if (ordersMeta) {
      const suffix = rows.length === 1 ? "" : "s";
      ordersMeta.textContent = `${rows.length} demande${suffix} liée${suffix} à ce compte.`;
    }
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

  async function loadOrderHistory() {
    const res = await apiFetch("/rest/v1/rpc/bl_customer_order_history", {
      method: "POST",
      body: "{}",
    });
    const rows = await res.json();
    const safeRows = Array.isArray(rows) ? rows : [];
    personalCurrent = safeRows.reduce((total, row) => {
      if (row.status !== "validated" && row.status !== "completed") return total;
      return total + Math.max(0, Number(row.confirmed_order_count) || 0);
    }, 0);
    renderOrders(safeRows);
  }

  async function init() {
    const session = window.BLAuthUi?.getStoredSession?.();
    accessToken = session && session.access_token;
    if (!accessToken) {
      setStatus("Connecte-toi pour accéder à ton historique.", true);
      return;
    }

    try {
      await Promise.all([loadGlobalBarometer(), loadOrderHistory()]);
      renderCounts();
      setStatus("Historique sécurisé chargé.", false);
    } catch (err) {
      setStatus(err.message || "Impossible de charger ton historique.", true);
    }
  }

  init();
})();
