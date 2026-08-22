# Soumission protégée des demandes

Cette Edge Function est le seul point d'entrée autorisé pour créer une
ligne dans `public.order_requests`. Elle :

1. exige un compte Supabase connecté et un JWT utilisateur valide ;
2. ajoute automatiquement le nom, l'e-mail et l'identifiant du compte à la demande ;
3. valide tous les champs côté serveur ;
4. ignore les robots simples détectés par le champ leurre ;
5. vérifie le jeton Turnstile auprès de Cloudflare ;
6. vérifie l'action `order_request` et le hostname ;
7. bloque une seconde demande du même compte pendant deux minutes ;
8. insère la demande avec le client Supabase administrateur.

## Secrets

- `TURNSTILE_SECRET_KEY` : clé secrète du widget Cloudflare, uniquement dans Supabase ;
- `TURNSTILE_ALLOWED_HOSTNAMES` : liste optionnelle séparée par des virgules.

La clé de site Turnstile est publique et se place dans
`assets/js/auth-config.js` sous `BL_TURNSTILE_SITE_KEY`.

## Déploiement

```bash
supabase secrets set TURNSTILE_SECRET_KEY=xxxxxxxx
supabase functions deploy submit-order-request --no-verify-jwt
```

L'option `--no-verify-jwt` laisse `withSupabase({ auth: "user" })` vérifier le
JWT et fournir les informations du compte au gestionnaire de la fonction.

Après un test réel réussi, exécuter `supabase/secure_order_requests.sql` afin de
supprimer la policy `order_requests_insert_public`. Sans cette dernière étape,
un appel direct à l'API REST pourrait encore contourner Turnstile.
