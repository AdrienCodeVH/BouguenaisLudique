# Notification des demandes de commande

Cette Edge Function reçoit uniquement les événements `INSERT` de la table
`public.order_requests`, puis envoie une notification avec Resend.

## Secrets requis

Configurer les secrets dans Supabase sans jamais les committer :

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxx \
  ORDER_NOTIFICATION_TO=adresse-administrateur@example.com \
  ORDER_NOTIFICATION_FROM='Bouguenais Ludique <onboarding@resend.dev>'
```

`ORDER_ADMIN_URL` est optionnel. Par défaut, il pointe vers la page
d'administration GitHub Pages du projet.

## Déploiement

```bash
supabase functions deploy notify-order-request --no-verify-jwt
```

La vérification JWT de la passerelle est désactivée parce que la fonction utilise
`withSupabase({ auth: "secret:*" })`. Le format `Authorization: Bearer ...` ajouté
par Database Webhooks est normalisé vers l'en-tête `apikey` attendu par le
wrapper, qui vérifie ensuite que la valeur appartient bien aux clés secrètes du
projet. Les appels publics ou anonymes restent refusés.

## Webhook Supabase

Dans **Database > Webhooks**, créer un webhook avec :

- table : `public.order_requests` ;
- événement : `INSERT` uniquement ;
- type : Supabase Edge Functions ;
- fonction : `notify-order-request` ;
- méthode : `POST` ;
- authentification : **Add auth header with service key**.

La demande reste enregistrée même si le prestataire e-mail est momentanément
indisponible, car les Database Webhooks Supabase sont asynchrones.
