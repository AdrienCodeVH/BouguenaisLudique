/**
 * Dashboard Supabase → Project Settings → API
 *
 * BL_SUPABASE_ANON_KEY = clé PUBLIQUE uniquement :
 *   • « Publishable » / « anon » / « public » — OK dans le navigateur
 *   • souvent sb_publishable_… ou eyJ… (JWT)
 *
 * Ne jamais mettre la clé « Secret » (sb_secret_…) dans ce fichier :
 * le navigateur est public ; Supabase bloque alors : « Forbidden use of secret API key ».
 */
window.BL_SUPABASE_URL = "https://VOTRE_PROJECT.supabase.co";
window.BL_SUPABASE_ANON_KEY =
  "sb_publishable_vjhOKFgP-KUAzALnNJkD0A_6v22uAG9";
