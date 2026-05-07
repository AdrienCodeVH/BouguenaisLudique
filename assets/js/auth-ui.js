(function () {
  function getStoredSession() {
    try {
      const raw = sessionStorage.getItem("bl_auth_session");
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function getBasePath() {
    return window.location.pathname.includes("/pages/") ? ".." : ".";
  }

  function getLoginPath() {
    const base = getBasePath();
    return `${base}/pages/connexion.html`;
  }

  function getSignupPath() {
    const base = getBasePath();
    return `${base}/pages/inscription.html`;
  }

  function getAdminPath() {
    const base = getBasePath();
    return `${base}/pages/admin.html`;
  }

  function getProfilePath(isAdmin) {
    const base = getBasePath();
    return isAdmin ? getAdminPath() : `${base}/pages/mon-espace.html`;
  }

  function parseJwtPayload(token) {
    if (!token || token.split(".").length < 2) return null;
    try {
      const payload = token.split(".")[1];
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "===".slice((normalized.length + 3) % 4);
      return JSON.parse(atob(padded));
    } catch (_) {
      return null;
    }
  }

  async function fetchCurrentRole(accessToken, userId) {
    const cfg = window.BLAuth?.getSupabaseConfig?.();
    if (!cfg || !cfg.isConfigured || !accessToken || !userId) return null;

    const endpoint = `${cfg.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`;
    const res = await fetch(endpoint, {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0].role || null;
  }

  function createNavLink(label, href, className) {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    if (className) link.className = className;
    return link;
  }

  function upsertAdminLink(nav, isAdmin) {
    if (nav.querySelector("[data-auth-admin-profile-link]")) return;
    const existing = nav.querySelector("[data-auth-admin-link]");
    if (!isAdmin) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    const adminLink = createNavLink("Admin", getAdminPath(), "main-nav-btn main-nav-btn--ghost");
    adminLink.setAttribute("data-auth-admin-link", "true");
    nav.appendChild(adminLink);
  }

  function upsertSessionLinks(nav, isLoggedIn, isAdmin) {
    const loginLink = nav.querySelector('a[href$="connexion.html"]');
    const signupLink = nav.querySelector('a[href$="inscription.html"]');
    const existingProfile = nav.querySelector("[data-auth-profile-link]");
    const existingAdminProfile = nav.querySelector("[data-auth-admin-profile-link]");
    const existingLogout = nav.querySelector("[data-auth-logout]");

    if (!isLoggedIn) {
      if (!loginLink) {
        nav.appendChild(
          createNavLink("Connexion", getLoginPath(), "main-nav-btn main-nav-btn--ghost")
        );
      }
      if (!signupLink) {
        nav.appendChild(
          createNavLink("S'inscrire", getSignupPath(), "main-nav-btn main-nav-btn--primary")
        );
      }
      if (existingProfile) existingProfile.remove();
      if (existingAdminProfile) existingAdminProfile.remove();
      if (existingLogout) existingLogout.remove();
      return;
    }

    if (loginLink) loginLink.remove();
    if (signupLink) signupLink.remove();

    if (isAdmin) {
      if (existingProfile) existingProfile.remove();
      if (!existingAdminProfile) {
        const adminProfileLink = createNavLink("Admin", getAdminPath(), "main-nav-btn main-nav-btn--primary");
        adminProfileLink.setAttribute("data-auth-admin-profile-link", "true");
        nav.appendChild(adminProfileLink);
      }
    } else if (!existingProfile) {
      if (existingAdminProfile) existingAdminProfile.remove();
      const profileLink = createNavLink("Mon espace", getProfilePath(), "main-nav-btn main-nav-btn--ghost");
      profileLink.setAttribute("data-auth-profile-link", "true");
      nav.appendChild(profileLink);
    }

    if (!existingLogout) {
      const logoutBtn = document.createElement("button");
      logoutBtn.type = "button";
      logoutBtn.textContent = "Déconnexion";
      logoutBtn.className = "main-nav-btn main-nav-btn--primary";
      logoutBtn.setAttribute("data-auth-logout", "true");
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("bl_auth_session");
        window.location.href = getLoginPath();
      });
      nav.appendChild(logoutBtn);
    }
  }

  async function initAuthUi() {
    const nav = document.querySelector(".main-nav");
    if (!nav) return;

    const session = getStoredSession();
    const accessToken = session && session.access_token;
    if (!accessToken) {
      upsertSessionLinks(nav, false, false);
      upsertAdminLink(nav, false);
      return;
    }

    const payload = parseJwtPayload(accessToken);
    const userId = payload && payload.sub;
    const role = await fetchCurrentRole(accessToken, userId);
    const isAdmin = role === "admin";

    upsertSessionLinks(nav, true, isAdmin);
    upsertAdminLink(nav, isAdmin);
  }

  window.BLAuthUi = {
    getStoredSession,
    parseJwtPayload,
    fetchCurrentRole,
  };

  initAuthUi();
})();
