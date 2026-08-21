(function () {
  const countdownNode = document.getElementById("confirmation-countdown");
  const productNode = document.getElementById("confirmation-product");
  const confirmationStorageKey = "bl_order_confirmation";
  const redirectDelayMs = 8000;
  const deadline = Date.now() + redirectDelayMs;

  try {
    const confirmation = JSON.parse(sessionStorage.getItem(confirmationStorageKey) || "null");
    if (confirmation && typeof confirmation.product_name === "string") {
      const productName = confirmation.product_name.trim();
      if (productName && productNode) {
        productNode.textContent = `Demande enregistrée : ${productName}`;
        productNode.hidden = false;
      }
    }
  } catch (_) {
    // La confirmation générique reste affichée si le stockage est indisponible.
  }

  function returnHome() {
    sessionStorage.removeItem(confirmationStorageKey);
    window.location.replace("../index.html");
  }

  function updateCountdown() {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (countdownNode) countdownNode.textContent = String(remaining);
    if (remaining === 0) {
      window.clearInterval(countdownTimer);
      returnHome();
    }
  }

  const countdownTimer = window.setInterval(updateCountdown, 250);
  updateCountdown();
})();
