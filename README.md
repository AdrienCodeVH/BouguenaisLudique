# Bouguenais Ludique

Site vitrine/catalogue de jeux avec authentification Supabase et espace d'administration.

## Aperçu

Le projet propose :
- une page d'accueil orientée storytelling avec navigation par slides ;
- une page de demande de commande avant ouverture d'un catalogue complet ;
- des pages de connexion/inscription connectees a Supabase Auth ;
- un espace admin pour gerer les roles, le barometre, les produits et les demandes de commande.

Le site est en HTML/CSS/JavaScript natif (sans bundler ni framework front).

## Fonctionnalites

- Navigation globale : accueil, demande de commande, contact, connexion, inscription.
- Mise en ligne : métadonnées SEO et sociales, image Open Graph, sitemap, robots et page 404.
- Transparence : mentions légales, politique de confidentialité et liens présents dans chaque pied de page.
- Authentification email/mot de passe via Supabase REST (`/auth/v1`).
- Stockage de session cote navigateur (`sessionStorage`).
- Affichage conditionnel dans la navbar :
  - visiteur : liens Connexion / S'inscrire ;
  - utilisateur connecte : Mon espace / Deconnexion ;
  - admin : lien Admin supplementaire.
- Parcours de commande initial :
  - le visiteur exprime son besoin via le formulaire de demande ;
  - Turnstile vérifie le visiteur et une Edge Function valide les champs côté serveur ;
  - la demande est ensuite stockée dans `order_requests` sans autoriser d'insertion publique directe ;
  - une Edge Function peut notifier l'administrateur par e-mail via Resend ;
  - la disponibilite, le prix et le retrait sont confirmes manuellement ;
  - le catalogue public complet sera ouvert quand les premieres commandes auront permis de prioriser l'offre.
- Barometre du projet :
  - valeur statique par defaut dans `index.html` ;
  - surcharge dynamique depuis la table `project_barometer` si Supabase est configure.
- Espace client (`pages/mon-espace.html`) :
  - historique en lecture seule des demandes liées à l'e-mail du compte ;
  - contribution personnelle calculée uniquement depuis les quantités validées ;
  - aucune déclaration libre de commande ou de récompense côté client.
- Espace admin (`pages/admin.html`) :
  - changement de role utilisateur (`client`, `employee`, `admin`) ;
  - mise a jour du barometre ;
  - ajout/suppression de produits ;
  - suivi des demandes avec statut, quantité validée et liaison automatique au compte client.

## Arborescence

```text
.
├── index.html
├── 404.html
├── robots.txt
├── sitemap.xml
├── pages/
│   ├── admin.html
│   ├── catalogue.html
│   ├── cartes-collection.html
│   ├── jeux-societe.html
│   ├── classiques-puzzle-echecs.html
│   ├── connexion.html
│   ├── inscription.html
│   ├── mentions-legales.html
│   ├── confidentialite.html
│   └── contact.html
├── assets/
│   ├── css/style.css
│   ├── images/og-bouguenais-ludique.png
│   └── js/
│       ├── script.js
│       ├── auth-config.js
│       ├── auth-config.example.js
│       ├── auth-api.js
│       ├── auth-ui.js
│       ├── connexion.js
│       ├── inscription.js
│       └── admin.js
└── supabase/
    ├── schema.sql
    └── functions/
        └── notify-order-request/
            ├── index.ts
            └── README.md
```

## Prerequis

- Python 3 (pour servir localement le site statique), ou tout autre serveur HTTP statique.
- Un projet Supabase (optionnel pour visualiser le site, requis pour auth/admin/barometre dynamique).

## Lancement en local

Depuis la racine du projet :

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Puis ouvrir :
- `http://127.0.0.1:5173/`
- `http://127.0.0.1:5173/pages/admin.html` (zone admin)

## Tests

Depuis la racine du projet :

```bash
python3 -m unittest discover -s tests
```

Les tests statiques verifient notamment le parcours de demande de commande, l'absence de
catalogue public ouvert, les liens HTML locaux, les pages légales, les métadonnées sociales,
la page 404, le fichier robots et le sitemap.

## Informations à finaliser avant l'ouverture commerciale

Les pages légales sont structurées mais n'inventent aucune donnée d'entreprise. Les champs
suivants restent explicitement signalés comme à compléter dans `pages/mentions-legales.html` :

- identité de l'entrepreneur ou raison sociale ;
- statut juridique et numéro d'immatriculation ;
- numéro de téléphone ;
- directeur de publication ;
- médiateur de la consommation.

La page doit être mise à jour dès que ces informations sont connues et avant la première vente.

## Configuration Supabase

1. Creer un projet Supabase.
2. Executer `supabase/schema.sql` dans **Supabase > SQL Editor**.
3. Renseigner `assets/js/auth-config.js` :

```js
window.BL_SUPABASE_URL = "https://VOTRE_PROJET.supabase.co";
window.BL_SUPABASE_ANON_KEY = "VOTRE_CLE_PUBLISHABLE_OU_ANON";
window.BL_TURNSTILE_SITE_KEY = "VOTRE_CLE_SITE_TURNSTILE";
```

4. Ne jamais utiliser de cle `sb_secret_` dans le front.

> Le fichier `auth-config.example.js` sert de modele.

## Notifications des demandes

La fonction `supabase/functions/notify-order-request/index.ts` envoie une notification
à l'administrateur lorsqu'une ligne est ajoutée à `public.order_requests`.

La configuration repose sur :

- une Edge Function Supabase déployée sans vérification JWT de passerelle ;
- `withSupabase({ auth: "secret:*" })` pour n'accepter que le webhook authentifié ;
- les secrets `RESEND_API_KEY` et `ORDER_NOTIFICATION_TO` stockés dans Supabase ;
- un Database Webhook sur l'événement `INSERT` de `public.order_requests`.

Les instructions de déploiement sont détaillées dans
`supabase/functions/notify-order-request/README.md`. Aucune clé Resend ne doit être
placée dans le dépôt ou dans le JavaScript public.

## Protection anti-spam

Le navigateur envoie les demandes avec le jeton du compte connecté à
`supabase/functions/submit-order-request/index.ts`. Cette fonction vérifie le
compte, ajoute automatiquement son nom et son e-mail, puis vérifie le jeton Cloudflare Turnstile, l'action
et le hostname avant d'insérer la ligne avec le client serveur. La policy d'insertion publique est supprimée par
`supabase/secure_order_requests.sql`, ce qui empêche de contourner la protection
en appelant directement l'API REST.

## Initialisation d'un compte admin

Le SQL fournit dans `supabase/schema.sql` contient un bloc de bootstrap admin :
1. creer un compte via `pages/inscription.html` ;
2. remplacer l'email exemple dans le script SQL ;
3. executer le bloc pour promouvoir ce compte en `admin`.

## Modele de donnees (resume)

- `public.profiles`
  - `id` (uuid, lie a `auth.users`)
  - `display_name` (text)
  - `role` (`admin` | `employee` | `client`)
  - `created_at`
- `public.project_barometer`
  - `current_orders`, `target_orders`, `next_milestone`
- `public.products`
  - `name`, `category`, `price_eur`, `is_active`, timestamps
- `public.order_requests`
  - demandeur, e-mail, univers, produit recherche, budget, details, statut
  - quantité validée et `linked_user_id` résolu automatiquement depuis Supabase Auth

Le schema active la RLS et applique des policies pour :
- lecture publique du barometre et des produits ;
- ecriture reservee aux admins ;
- historique client exposé par la fonction sécurisée `bl_customer_order_history()` ;
- anciennes lignes `user_orders` conservées mais exclues du baromètre global ;
- gestion fine des droits sur `profiles`.

## Historique client sécurisé

La migration `supabase/secure_customer_order_history.sql` :

1. rattache les demandes existantes aux comptes ayant le même e-mail ;
2. rattache aussi une ancienne demande lorsqu'un compte est créé plus tard ;
3. supprime les policies permettant à un client de s'auto-créditer ;
4. recalcule le baromètre uniquement depuis les demandes `validated` ou `completed` ;
5. expose au client un historique limité, sans e-mail ni notes internes.

Elle est idempotente et s'exécute dans Supabase → SQL Editor.

## Notes securite

- La cle Supabase front doit etre **publishable/anon uniquement**.
- Les operations sensibles reposent sur la RLS (pas sur la seule UI).
- Les valeurs de `auth-config.js` sont cote client : eviter d'y mettre des informations privees.
- Les secrets d'envoi d'e-mails restent exclusivement dans les secrets des Edge Functions Supabase.

## Limites actuelles

- Pas de pipeline de tests automatise.
- Front en JavaScript vanilla (pas de type checking ni build step).
- Le catalogue public complet n'est pas encore ouvert : le projet privilegie d'abord les demandes de commande manuelles.
- Pas de formulaire de contact en ligne (contact par email).
