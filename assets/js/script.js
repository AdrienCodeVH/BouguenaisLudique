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

const comingSoonMessage = "Bientôt disponible.";
const comingSoonCardText = "Bientôt disponible.";

function markCardAsComingSoon(trigger) {
  if (!trigger.classList.contains("card")) {
    return false;
  }

  const paragraphs = trigger.querySelectorAll("p");
  if (paragraphs.length === 0) {
    return false;
  }

  paragraphs.forEach((paragraph) => {
    paragraph.textContent = comingSoonCardText;
  });

  return true;
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
  if (!markCardAsComingSoon(trigger)) {
    window.alert(comingSoonMessage);
  }
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
  const trigger = target.closest("[data-coming-soon]");
  if (!trigger || !markCardAsComingSoon(trigger)) {
    window.alert(comingSoonMessage);
  }
});

async function loadProjectBarometer() {
  const container = document.querySelector(".project-barometer");
  if (!container || !window.BLAuth?.getSupabaseConfig) {
    return;
  }

  const cfg = window.BLAuth.getSupabaseConfig();
  if (!cfg.isConfigured) {
    return;
  }

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/project_barometer?select=current_orders,target_orders,next_milestone&order=id.asc&limit=1`,
      {
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
        },
      }
    );
    if (!res.ok) return;
    const rows = await res.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) return;
    const data = rows[0];

    const current = Number(data.current_orders);
    const target = Number(data.target_orders);
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
    if (hint && data.next_milestone) {
      hint.textContent = `Prochain palier : ${data.next_milestone}`;
    }

    const rulesRes = await fetch(
      `${cfg.url}/rest/v1/admin_threshold_rules?select=label,min_orders,is_triggered,visibility,scope&visibility=eq.public&scope=eq.global&is_triggered=eq.true&order=min_orders.asc`,
      {
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
        },
      }
    );
    if (!rulesRes.ok) return;
    const rules = await rulesRes.json().catch(() => []);
    if (hint && Array.isArray(rules) && rules.length > 0) {
      const messages = rules.map((rule) => `${rule.label} (>= ${rule.min_orders})`);
      hint.textContent = `Actions en cours : ${messages.join(" | ")}`;
    }
    container.hidden = false;
  } catch (_) {
    // Laisse le baromètre masque tant que les donnees ne sont pas disponibles.
  }
}

loadProjectBarometer();
