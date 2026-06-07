# Bouguenais Ludique

Site vitrine/catalogue de jeux avec authentification Supabase et espace d'administration.

## Aperçu

Le projet propose :
- une page d'accueil orientée storytelling avec navigation par slides ;
- une page de demande de commande avant ouverture d'un catalogue complet ;
- des pages de connexion/inscription connectees a Supabase Auth ;
- un espace admin pour gerer les roles, le barometre de commandes et les produits.

Le site est en HTML/CSS/JavaScript natif (sans bundler ni framework front).

## Fonctionnalites

- Navigation globale : accueil, demande de commande, contact, connexion, inscription.
- Authentification email/mot de passe via Supabase REST (`/auth/v1`).
- Stockage de session cote navigateur (`sessionStorage`).
- Affichage conditionnel dans la navbar :
  - visiteur : liens Connexion / S'inscrire ;
  - utilisateur connecte : Mon espace / Deconnexion ;
  - admin : lien Admin supplementaire.
- Parcours de commande initial :
  - le visiteur exprime son besoin par contact ;
  - la disponibilite, le prix et le retrait sont confirmes manuellement ;
  - le catalogue public complet sera ouvert quand les premieres commandes auront permis de prioriser l'offre.
- Barometre du projet :
  - valeur statique par defaut dans `index.html` ;
  - surcharge dynamique depuis la table `project_barometer` si Supabase est configure.
- Espace admin (`pages/admin.html`) :
  - changement de role utilisateur (`client`, `employee`, `admin`) ;
  - mise a jour du barometre ;
  - ajout/suppression de produits.

## Arborescence

```text
.
├── index.html
├── pages/
│   ├── admin.html
│   ├── catalogue.html
│   ├── cartes-collection.html
│   ├── jeux-societe.html
│   ├── classiques-puzzle-echecs.html
│   ├── connexion.html
│   ├── inscription.html
│   └── contact.html
├── assets/
│   ├── css/style.css
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
    └── schema.sql
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

## Configuration Supabase

1. Creer un projet Supabase.
2. Executer `supabase/schema.sql` dans **Supabase > SQL Editor**.
3. Renseigner `assets/js/auth-config.js` :

```js
window.BL_SUPABASE_URL = "https://VOTRE_PROJET.supabase.co";
window.BL_SUPABASE_ANON_KEY = "VOTRE_CLE_PUBLISHABLE_OU_ANON";
```

4. Ne jamais utiliser de cle `sb_secret_` dans le front.

> Le fichier `auth-config.example.js` sert de modele.

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

Le schema active la RLS et applique des policies pour :
- lecture publique du barometre et des produits ;
- ecriture reservee aux admins ;
- gestion fine des droits sur `profiles`.

## Notes securite

- La cle Supabase front doit etre **publishable/anon uniquement**.
- Les operations sensibles reposent sur la RLS (pas sur la seule UI).
- Les valeurs de `auth-config.js` sont cote client : eviter d'y mettre des informations privees.

## Limites actuelles

- Pas de pipeline de tests automatise.
- Front en JavaScript vanilla (pas de type checking ni build step).
- Le catalogue public complet n'est pas encore ouvert : le projet privilegie d'abord les demandes de commande manuelles.
- Pas de formulaire de contact en ligne (contact par email).
