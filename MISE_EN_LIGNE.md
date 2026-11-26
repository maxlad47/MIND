# Mettre MIND en ligne (GitHub Pages + Supabase)

Résultat : une adresse `https://maxlad47.github.io/MIND/` que ton frère et ta copine ouvrent sur leur iPhone.
Ils créent un compte, et tu vois leurs programmes et leurs séances dans ton espace coach, en temps réel.

## 1. Supabase (la base de données et les comptes) — 10 min

1. Crée un compte sur https://supabase.com puis **New project** (nom : `mind`, région : `West EU (Paris)` si disponible, note le mot de passe de la base).
2. **Authentication → Providers → Email** : désactive **« Confirm email »** (sinon chaque nouvel inscrit doit cliquer un lien reçu par mail).
3. **SQL Editor → New query** : ouvre `supabase/setup.sql`, remplace `TON-EMAIL@exemple.com` par **l'email avec lequel tu créeras ton compte coach**, colle tout, **Run**.
4. **Project Settings → API** : copie **Project URL** et la clé **anon public**.
   (Ne copie jamais la clé `service_role`.)
5. **Supprimer des profils** (bouton « Supprimer le profil » de la fiche client) : **SQL Editor → New query**, colle tout `supabase/suppression.sql`, **Run** → *« Success. No rows returned »*. Une seule fois ; sans ça, l'app affiche « Suppression pas encore activée sur le serveur ».

## 2. Brancher le site — 2 min

Ouvre le fichier `.env.production` et colle les deux valeurs :

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Ces deux valeurs sont publiques par conception : la protection des données vient des règles de sécurité (RLS) créées à l'étape 1.

## 3. Publier sur GitHub Pages — 3 min

1. Sur GitHub, dans le dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
2. Envoie le projet (une fois, ou à chaque mise à jour) :
   ```bash
   git add -A && git commit -m "Mise à jour" && git push
   ```
3. Onglet **Actions** : attends le ✅ (1 à 2 min). Le site est en ligne.

## 4. Premier lancement

1. Ouvre l'adresse dans **Safari** sur ton iPhone, **crée ton compte avec l'email coach** : tu arrives dans l'espace coach.
2. Envoie l'adresse à ton frère et ta copine. Ils créent leur compte, remplissent le formulaire, et apparaissent dans ta liste de clients.
3. Sur iPhone : Partager → **Sur l'écran d'accueil**.

## Ce qui est inclus / pas encore

- ✅ Comptes, programmes, séances, charges saisies, commentaires, alertes, suivi coach, temps réel.
- ✅ Utilisable sans réseau (salle en sous-sol) : les saisies partent dès que le réseau revient.
- ⏳ Notifications push serveur et personnalisation par l'IA : demandent des fonctions serveur Supabase supplémentaires (voir le README). L'app marche très bien sans : le moteur de règles fait tout le travail.

---

## Garmin : les courses arrivent toutes seules (clé API personnelle)

Chacun (toi, ton frère, ta compagne) crée **sa propre clé** dans Garmin Connect et la colle **une seule fois** dans MIND. La clé est stockée **chiffrée sur le serveur** (jamais sur le téléphone) ; MIND va chercher les nouvelles courses **toutes les 30 minutes**, à l'ouverture de l'app et au bouton « Synchroniser ». Chaque course est rattachée à la séance prévue ce jour-là ; il reste au client deux réponses : séance respectée ? effort (RPE) ?

> **Rien de tout ça n'est nécessaire pour tester l'app** : « Fait comme prévu », la saisie rapide et l'import d'un fichier .FIT marchent déjà, sans liaison.

### Ce que Claude a déjà préparé pour toi
- La CLI Supabase s'utilise avec `npx supabase …` (rien à installer).
- Le secret de chiffrement `GARMIN_KEY_SECRET` est **déjà généré** dans le fichier `.env.garmin.local` (ignoré par Git : il ne partira jamais sur GitHub). Tu n'as pas besoin de le lire.
- `.env.production` contient `VITE_GARMIN_PERSONAL=true`.

### Étapes pour toi, dans l'ordre
Une commande à la fois, dans le Terminal, depuis le dossier du projet.

1. **Te connecter à Supabase** : `npx supabase login` → le navigateur s'ouvre, valide. Le terminal affiche *« You are now logged in. »*
2. **Relier le dossier à ton projet** : `npx supabase link --project-ref awlpnsqphnmtzhbkadiy` (le mot de passe de la base est demandé : c'est celui noté à l'étape 1 ci-dessus). Tu dois voir *« Finished supabase link. »*
3. **Envoyer le secret** : `npx supabase secrets set --env-file .env.garmin.local` → *« Finished supabase secrets set. »*
4. **Créer les tables** : dans Supabase → **SQL Editor → New query**, colle le **BLOC 1** de `supabase/garmin.sql` (de « BLOC 1 » jusqu'à « BLOC 2 » exclu) → **Run** → *« Success. No rows returned »*.
5. **Déployer les deux fonctions** : `npx supabase functions deploy garmin-personal-link garmin-personal-sync` → *« Deployed Functions … garmin-personal-link, garmin-personal-sync »*.
6. **Activer la synchro toutes les 30 minutes** : dans le SQL Editor, colle le **BLOC 2** de `supabase/garmin.sql` après avoir remplacé `<PROJECT_REF>` par `awlpnsqphnmtzhbkadiy` et `<SERVICE_ROLE_KEY>` par la clé **service_role** (Project Settings → API → *service_role*, bouton « Reveal »). **Run** → une ligne avec un numéro de tâche. Cette clé reste dans la base : ne la colle nulle part ailleurs.
7. **Autoriser ton frère et ta compagne** : dans MIND, fiche du client → onglet **Profil** → interrupteur **« Autoriser la liaison Garmin par clé personnelle »**. Toi, tu y as toujours droit.
8. **Chacun se lie** : Profil → **Montre** → *Lier avec ma clé Garmin personnelle*, puis suit l'aide pas à pas (Safari → connect.garmin.com → Réglages → Personal API → créer une clé, durée **1 an** → copier → coller dans MIND).

> **Ne colle jamais ta clé Garmin dans une conversation** : seulement dans MIND.

### Tester avec ta vraie montre avant de pousser
```bash
npm run dev -- --mode production
```
Cette commande lance l'app **en local** mais branchée sur le **vrai Supabase** (elle lit `.env.production`). Le Terminal affiche une adresse `Local` (ordinateur) et une adresse `Network` (iPhone, même Wi-Fi). Connecte-toi avec ton compte coach, lie ta clé, fais une sortie, attends la synchro (ou touche « Synchroniser »). Quand tout va bien, tu peux pousser.

### Renouvellement et problèmes
- MIND prévient le client **10 jours puis 2 jours** avant l'expiration de sa clé (et toi aussi). Pour renouveler : créer une nouvelle clé chez Garmin et la coller dans MIND (l'ancienne devient invalide).
- Clé refusée ou expirée : statut **« à renouveler »**, la synchro de ce compte s'arrête, le client et toi êtes prévenus. Jamais d'erreur silencieuse.
- Garmin ralentit ou refuse (429, erreur serveur) : MIND s'arrête pour ce compte et réessaie au tour suivant, sans insister.
- **Délier** (Profil → Montre) supprime la clé du serveur ; pense à la supprimer aussi dans Garmin Connect.

### À savoir
- Les données de montre (courses, FC, pas, sommeil) **ne sont jamais envoyées à l'IA** (un seul filtre, testé). L'analyse par règles reste active.
- Les noms de champs des réponses Garmin pour les activités, les pas et le sommeil ne sont pas publiés : le détail des courses vient du fichier .FIT (fiable), pas du JSON. Si les pas ou le sommeil n'apparaissent pas, la liaison et les courses fonctionnent quand même (message « Pas et sommeil momentanément indisponibles »). Voir `TODO(garmin)` dans `shared/garmin/personal.ts`.
- **Accès officiel « Starter »** (liaison en un clic) : écrit et testé avec des réponses simulées, mais **non déployé et masqué** (`VITE_GARMIN_ENABLED` absent). À activer seulement quand Garmin répond, après relecture des `TODO(garmin)` de `shared/garmin/starter.ts`.
