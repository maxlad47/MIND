# Mettre MIND en ligne (GitHub Pages + Supabase)

Résultat : une adresse `https://maxlad47.github.io/MIND/` que ton frère et ta copine ouvrent sur leur iPhone.
Ils créent un compte, et tu vois leurs programmes et leurs séances dans ton espace coach, en temps réel.

## 1. Supabase (la base de données et les comptes) — 10 min

1. Crée un compte sur https://supabase.com puis **New project** (nom : `mind`, région : `West EU (Paris)` si disponible, note le mot de passe de la base).
2. **Authentication → Providers → Email** : désactive **« Confirm email »** (sinon chaque nouvel inscrit doit cliquer un lien reçu par mail).
3. **SQL Editor → New query** : ouvre `supabase/setup.sql`, remplace `TON-EMAIL@exemple.com` par **l'email avec lequel tu créeras ton compte coach**, colle tout, **Run**.
4. **Project Settings → API** : copie **Project URL** et la clé **anon public**.
   (Ne copie jamais la clé `service_role`.)

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
