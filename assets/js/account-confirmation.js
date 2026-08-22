(function () {
  const title = document.getElementById("account-confirmation-title");
  const eyebrow = document.getElementById("account-confirmation-eyebrow");
  const icon = document.getElementById("account-confirmation-icon");
  const message = document.getElementById("account-confirmation-message");
  const note = document.getElementById("account-confirmation-note");
  const action = document.getElementById("account-confirmation-action");
  if (!title || !eyebrow || !icon || !message || !note || !action) return;

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  hashParams.forEach((value, key) => params.set(key, value));

  const errorDescription = params.get("error_description") || params.get("error");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const confirmationType = params.get("type");

  if (errorDescription) {
    icon.textContent = "!";
    eyebrow.textContent = "Validation impossible";
    title.textContent = "Le lien n’a pas pu être validé";
    message.textContent = "Ce lien est peut-être expiré ou a déjà été utilisé.";
    note.textContent = "Tu peux recommencer l’inscription ou demander un nouveau lien.";
    action.textContent = "Retourner à l’inscription";
    action.href = "./inscription.html";
  } else if (accessToken && confirmationType === "signup") {
    const expiresIn = Number(params.get("expires_in"));
    const expiresAt = Number.isFinite(expiresIn)
      ? Math.floor(Date.now() / 1000) + expiresIn
      : undefined;

    sessionStorage.setItem(
      "bl_auth_session",
      JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken || undefined,
        expires_at: expiresAt,
      })
    );
  } else {
    icon.textContent = "?";
    eyebrow.textContent = "Lien incomplet";
    title.textContent = "Validation non détectée";
    message.textContent = "Cette page doit être ouverte depuis le lien reçu par e-mail.";
    note.textContent = "Si ton compte est déjà confirmé, tu peux simplement te connecter.";
    action.textContent = "Se connecter";
    action.href = "./connexion.html";
  }

  if (window.history?.replaceState) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
})();
