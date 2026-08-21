const infoButton = document.getElementById("infoButton");

if (infoButton) {
  infoButton.addEventListener("click", () => {
    alert("Le site Bouguenais Ludique est en cours de construction.");
  });
}

const slideLayout = document.querySelector(".slide-layout");
const slideTrack = document.querySelector(".slide-track");
const slidePanels = slideTrack ? Array.from(slideTrack.querySelectorAll(".slide-panel")) : [];
let activeSlide = 0;
let isLocked = false;

function goToSlide(index) {
  if (!slideTrack || slidePanels.length === 0) {
    return;
  }

  const nextIndex = Math.max(0, Math.min(index, slidePanels.length - 1));

  if (nextIndex === activeSlide) {
    return;
  }

  activeSlide = nextIndex;
  slideTrack.style.transform = `translateX(-${activeSlide * 100}%)`;
}

if (slideLayout && slidePanels.length > 1) {
  window.addEventListener("wheel", (event) => {
    if (window.innerWidth <= 900) {
      return;
    }

    event.preventDefault();

    if (isLocked) {
      return;
    }

    const direction = Math.sign(event.deltaY);
    if (direction === 0) {
      return;
    }

    isLocked = true;
    goToSlide(activeSlide + direction);

    window.setTimeout(() => {
      isLocked = false;
    }, 620);
  }, { passive: false });

  window.addEventListener("keydown", (event) => {
    if (window.innerWidth <= 900) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      goToSlide(activeSlide + 1);
    }

    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      goToSlide(activeSlide - 1);
    }
  });
}

const comingSoonMessage = "Cette rubrique sera disponible bientôt.";
const catalogueVisibleProductsLimit = 5;
let comingSoonModal = null;
let comingSoonModalText = null;

function ensureComingSoonModal() {
  if (comingSoonModal) {
    return comingSoonModal;
  }

  const style = document.createElement("style");
  style.textContent = `
    .coming-soon-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(15, 23, 42, 0.55);
    }
    .coming-soon-modal-overlay[hidden] {
      display: none !important;
    }
    .coming-soon-modal-card {
      width: min(460px, 100%);
      padding: 1rem 1.1rem;
      border-radius: 14px;
      background: #fff;
      border: 1px solid rgba(30, 64, 175, 0.2);
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.22);
      text-align: center;
    }
    .coming-soon-modal-card h3 {
      margin: 0 0 0.45rem;
      color: #1e40af;
    }
    .coming-soon-modal-card p {
      margin: 0 0 0.85rem;
      color: #1e293b;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.className = "coming-soon-modal-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Information");
  overlay.innerHTML = `
    <div class="coming-soon-modal-card">
      <h3>Bientôt disponible</h3>
      <p id="coming-soon-modal-text"></p>
      <button class="btn" type="button" data-coming-soon-close>Fermer</button>
    </div>
  `;
  document.body.appendChild(overlay);

  comingSoonModal = overlay;
  comingSoonModalText = overlay.querySelector("#coming-soon-modal-text");
  const closeButton = overlay.querySelector("[data-coming-soon-close]");

  function closeComingSoonModal() {
    overlay.hidden = true;
    overlay.style.display = "none";
  }

  overlay.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target === overlay || target.closest("[data-coming-soon-close]")) {
      closeComingSoonModal();
    }
  });

  if (closeButton instanceof HTMLButtonElement) {
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeComingSoonModal();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && comingSoonModal && !comingSoonModal.hidden) {
      closeComingSoonModal();
    }
  });

  return overlay;
}

function showComingSoonPopup(message) {
  const modal = ensureComingSoonModal();
  if (comingSoonModalText) {
    comingSoonModalText.textContent = message || comingSoonMessage;
  }
  modal.hidden = false;
  modal.style.display = "flex";
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const trigger = target.closest("[data-coming-soon]");
  if (!trigger) {
    return;
  }

  event.preventDefault();
  showComingSoonPopup(comingSoonMessage);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (!target.closest("[data-coming-soon]")) {
    return;
  }

  event.preventDefault();
  showComingSoonPopup(comingSoonMessage);
});

function countValidatedOrders(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((total, row) => {
    if (row.status !== "validated" && row.status !== "completed") return total;
    return total + Math.max(0, Number(row.confirmed_order_count) || 0);
  }, 0);
}

async function loadPersonalBarometer() {
  const container = document.querySelector(".project-barometer");
  if (!container) {
    return;
  }
  container.hidden = true;

  const session = window.BLAuthUi?.getStoredSession?.();
  const accessToken = session && session.access_token;
  if (!accessToken || !window.BLAuth?.getSupabaseConfig) return;

  const cfg = window.BLAuth.getSupabaseConfig();
  if (!cfg.isConfigured) {
    return;
  }

  try {
    const headers = {
      apikey: cfg.key,
      Authorization: `Bearer ${accessToken}`,
    };
    const [settingsRes, historyRes] = await Promise.all([
      fetch(
        `${cfg.url}/rest/v1/project_barometer?select=target_orders,next_milestone&order=id.asc&limit=1`,
        { headers }
      ),
      fetch(`${cfg.url}/rest/v1/rpc/bl_customer_order_history`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    ]);
    if (!settingsRes.ok || !historyRes.ok) return;

    const settingsRows = await settingsRes.json().catch(() => []);
    const historyRows = await historyRes.json().catch(() => []);
    if (!Array.isArray(settingsRows) || settingsRows.length === 0) return;
    const settings = settingsRows[0];

    const current = countValidatedOrders(historyRows);
    const target = Number(settings.target_orders);
    if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return;

    const progress = Math.max(0, Math.min(100, (current / target) * 100));
    const strong = container.querySelector(".project-barometer-count strong");
    const totalText = container.querySelector(".project-barometer-count");
    const track = container.querySelector(".project-barometer-track");
    const fill = container.querySelector(".project-barometer-fill");
    const hint = container.querySelector(".project-barometer-hint");

    if (strong) strong.textContent = String(current);
    if (totalText) {
      totalText.innerHTML = `<strong>${current}</strong><span class="project-barometer-count-sep">/</span>${target} commandes`;
    }
    if (track) {
      track.setAttribute("aria-valuenow", String(current));
      track.setAttribute("aria-valuemax", String(target));
    }
    if (fill) {
      fill.style.setProperty("--bar-target", `${progress}%`);
    }
    if (hint) {
      hint.textContent = settings.next_milestone
        ? `Prochain palier personnel : ${settings.next_milestone}`
        : "Seules vos commandes validées sont comptabilisées.";
    }
    container.hidden = false;
  } catch (_) {
    // Laisse le baromètre masqué hors connexion ou si les données personnelles sont indisponibles.
  }
}

loadPersonalBarometer();

function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return `${amount.toFixed(2)} EUR`;
}

function formatAgeLabel(ageMin, ageMax) {
  const min = Number.isFinite(Number(ageMin)) ? Number(ageMin) : null;
  const max = Number.isFinite(Number(ageMax)) ? Number(ageMax) : null;
  if (min !== null && max !== null) return `${min}-${max} ans`;
  if (min !== null) return `${min}+ ans`;
  if (max !== null) return `Jusqu'a ${max} ans`;
  return "Tout age";
}

function renderCatalogueProducts(rows) {
  const grid = document.getElementById("catalogue-products-grid");
  const status = document.getElementById("catalogue-products-status");
  if (!grid || !status) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    grid.innerHTML = "";
    status.textContent = "Aucun produit actif pour le moment.";
    return;
  }

  grid.innerHTML = rows
    .map((row) => {
      const imageHtml = row.image_url
        ? `<img class="tcg-card-image" src="${row.image_url}" alt="Photo produit ${row.name}" loading="lazy" />`
        : "";
      const videoHtml = row.video_url
        ? `<p><a class="tcg-card-game-link" href="${row.video_url}" target="_blank" rel="noopener noreferrer">Voir la video</a></p>`
        : "";
      return `
        <article class="card">
          ${imageHtml}
          <h3>${row.name}</h3>
          <p><strong>Categorie :</strong> ${row.category}</p>
          <p><strong>Prix :</strong> ${formatPrice(row.price_eur)}</p>
          <p><strong>Age :</strong> ${formatAgeLabel(row.age_min, row.age_max)}</p>
          ${videoHtml}
        </article>
      `;
    })
    .join("");
  status.textContent = `${rows.length} produit(s) charges.`;
}

async function fetchCatalogueProducts() {
  const grid = document.getElementById("catalogue-products-grid");
  const status = document.getElementById("catalogue-products-status");
  if (!grid || !status || !window.BLAuth?.getSupabaseConfig) {
    return;
  }

  const cfg = window.BLAuth.getSupabaseConfig();
  if (!cfg || !cfg.isConfigured) {
    status.textContent = "Catalogue indisponible tant que Supabase n'est pas configure.";
    return;
  }

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/products?select=id,name,category,price_eur,age_min,age_max,image_url,video_url,is_active,updated_at&is_active=eq.true&order=updated_at.desc&limit=${catalogueVisibleProductsLimit}`,
      {
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
        },
      }
    );
    if (!res.ok) {
      throw new Error("Impossible de charger les produits.");
    }
    const rows = await res.json().catch(() => []);
    renderCatalogueProducts(rows);
  } catch (_) {
    status.textContent = "Le catalogue ne peut pas etre charge pour le moment.";
  }
}

fetchCatalogueProducts();
window.setInterval(fetchCatalogueProducts, 8000);
