import { isAllowedTurnstileResult, validateSubmission } from "./index.ts";

const validPayload = {
  customer_name: " Camille ",
  customer_email: "CAMILLE@example.com",
  category: "jeux-societe",
  product_name: "Sky Team",
  player_age: 12,
  budget_eur: 30,
  details: "Je cherche ce jeu pour un cadeau prochainement.",
  pickup_notes: "Samedi matin",
  company_website: "",
  turnstile_token: "token-valide",
};

Deno.test("normalise une demande valide", () => {
  const result = validateSubmission(validPayload);
  if (!result) throw new Error("La demande devrait être valide");

  if (result.order.customer_name !== "Camille") {
    throw new Error("Nom non normalisé");
  }
  if (result.order.customer_email !== "camille@example.com") {
    throw new Error("E-mail non normalisé");
  }
});

Deno.test("refuse les champs hors limites et les jetons absents", () => {
  if (validateSubmission({ ...validPayload, details: "trop court" })) {
    throw new Error("Les détails trop courts doivent être refusés");
  }
  if (validateSubmission({ ...validPayload, turnstile_token: "" })) {
    throw new Error("Le jeton Turnstile est obligatoire");
  }
  if (validateSubmission({ ...validPayload, budget_eur: 100001 })) {
    throw new Error("Le budget maximal doit être contrôlé");
  }
});

Deno.test("vérifie le succès, l'action et le hostname Turnstile", () => {
  const allowed = new Set(["adriencodevh.github.io"]);
  const valid = {
    success: true,
    action: "order_request",
    hostname: "adriencodevh.github.io",
  };

  if (!isAllowedTurnstileResult(valid, allowed)) {
    throw new Error("Résultat valide refusé");
  }
  if (isAllowedTurnstileResult({ ...valid, action: "login" }, allowed)) {
    throw new Error("Une autre action doit être refusée");
  }
  if (
    isAllowedTurnstileResult({ ...valid, hostname: "example.com" }, allowed)
  ) {
    throw new Error("Un autre hostname doit être refusé");
  }
});
