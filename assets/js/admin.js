(function () {
  const statusNode = document.getElementById("admin-status");
  const contentNode = document.getElementById("admin-content");

  function setStatus(message, isError) {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.classList.toggle("form-feedback--error", Boolean(isError));
    statusNode.hidden = !message;
  }

  async function initAdminPage() {
    const session = window.BLAuthUi?.getStoredSession?.();
    const accessToken = session && session.access_token;
    if (!accessToken) {
      setStatus("Connecte-toi d'abord pour accéder à l'espace admin.", true);
      return;
    }

    const payload = window.BLAuthUi?.parseJwtPayload?.(accessToken);
    const userId = payload && payload.sub;
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
    if (contentNode) contentNode.hidden = false;
  }

  initAdminPage();
})();
