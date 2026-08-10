# Diagnostic Railway et Supabase — lot-watcher-pro

**Date du contrôle :** 10 août 2026  
**Périmètre :** dépôt `Hamedchedly/lot-watcher-pro`, service Railway « Patrimoine-S11 », base Supabase externe utilisée par le dashboard.

## Conclusion

Le service Railway est marqué **Online**, mais l’application ne fonctionne pas : le domaine public renvoie actuellement **HTTP 404**. La cause immédiate est une détection erronée du projet comme **site Vite statique**. Railway copie le dossier `dist` puis démarre Caddy, alors que l’application est une application TanStack Start avec SSR et *server functions*. Le dashboard dépend précisément de ces fonctions serveur ; il ne peut donc pas fonctionner comme un simple site statique.[1]

Un second défaut bloquera le rétablissement tant qu’il n’est pas corrigé : les variables `EXT_SUPABASE_URL` et `EXT_SUPABASE_SERVICE_ROLE_KEY`, que le dashboard utilise explicitement, ne sont pas configurées sur Railway. En outre, le schéma Supabase de production ne contient pas trois colonnes aujourd’hui attendues par le code. La connexion Supabase elle-même est saine et les données ne sont pas perdues à l’instant du contrôle : **65 commandes actives**, **0 archivée** et **120 tranches actives** ont été lues avec succès.

> **Priorité immédiate :** ne pas relancer un import de données avant d’avoir corrigé le schéma et la stratégie d’archivage. Le code actuel peut désactiver toutes les commandes absentes d’un import partiel.

| Élément | État vérifié | Conséquence |
|---|---:|---|
| Domaine Railway | HTTP 404 | L’application est inaccessible au public. |
| Déploiement Railway | Réussi techniquement, mais en mode Vite/Caddy statique | Les fonctions serveur et le SSR ne sont pas exécutés. |
| Variables Supabase Railway | 5 variables présentes, `EXT_*` absentes | Le dashboard échouera dès qu’il sera exécuté côté serveur. |
| Supabase externe | Connexion de lecture réussie | La base répond et contient les données contrôlées. |
| Schéma Supabase | 3 colonnes attendues absentes | Imports et fonctions de dashboard partiellement incompatibles. |
| Import récent | 93 lignes par fichier, mais 0 création/modification | Le fichier répété paraît inchangé ; des erreurs antérieures restent à expliquer. |

## 1. Pourquoi Railway ne fonctionne plus

Les journaux du dernier déploiement indiquent que Railway a détecté le projet comme :

> `Deploying as vite static site`  
> `Output directory: dist`  
> `caddy run --config /Caddyfile`

Le domaine `https://patrimoine-s11-production.up.railway.app/` retourne **404**, ce qui concorde avec les journaux réseau du conteneur Caddy. Railway ne lance donc pas le serveur Nitro/TanStack Start. Cette détection est favorisée par l’absence de script `start` dans le `package.json` et par le script de build qui copie `.output` vers `dist`.

Or l’application n’est pas purement statique. Le fichier `src/routes/dashboard-travaux.tsx` appelle `getTravauxDashboard`, une *server function*, et les fonctions correspondantes lisent Supabase côté serveur. Railway précise qu’une application TanStack Start doit être déployée comme un service Node exécutant le serveur généré, et non comme un hébergement statique.[1]

### Deuxième défaut à traiter avant tout redéploiement Node

Un essai local avec un build Node (`NITRO_PRESET=node-server`) a bien démarré le serveur sur un port TCP, mais la route `/` a retourné **HTTP 500** avec :

```text
TypeError: __exportAll is not a function
```

L’erreur provient d’un cycle de modules dans les artefacts SSR générés. Elle est indépendante du 404 actuel, mais elle empêchera le fonctionnement dès que Railway lancera réellement le serveur Node. Le simple changement du mode de déploiement ne suffira donc pas : l’empaquetage SSR et les versions TanStack/Lovable devront être stabilisés avant mise en production.

| Preuve | Observation | Diagnostic |
|---|---|---|
| Journaux de build Railway | Détection « vite static site », sortie `dist`, démarrage Caddy | Mauvais type de service pour TanStack Start. |
| Journaux réseau Railway | Requête `GET /` avec statut 404 | Le domaine fonctionne, mais aucun serveur d’application ne répond. |
| Test HTTP externe | `GET /` → 404 | Symptôme reproductible hors de Railway. |
| Test Node local | Le processus écoute, mais `/` → 500 avec `__exportAll` | Défaut SSR supplémentaire à corriger. |

## 2. Variables Railway : écart avec les besoins du code

Les variables présentes dans Railway sont : `GOOGLE_MAPS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_GOOGLE_MAPS_BROWSER_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY` et `VITE_SUPABASE_URL`.

En revanche, le dashboard travaux utilise le client `src/integrations/supabase-ext/client.server.ts`, qui exige exactement `EXT_SUPABASE_URL` et `EXT_SUPABASE_SERVICE_ROLE_KEY`. Ces deux variables ne sont pas présentes dans le service Railway. Par ailleurs, le client serveur standard attend `SUPABASE_URL`, qui est également absent.

| Variable attendue par le code | Présente sur Railway | Usage | Action requise |
|---|---:|---|---|
| `EXT_SUPABASE_URL` | Non | Dashboard et import travaux, côté serveur | Ajouter l’URL du projet Supabase externe. |
| `EXT_SUPABASE_SERVICE_ROLE_KEY` | Non | Dashboard et import travaux, côté serveur | Ajouter la clé de rôle service correspondante, sans l’exposer au navigateur. |
| `SUPABASE_URL` | Non | Client serveur standard / authentification | Ajouter si les routes associées sont utilisées. |
| `SUPABASE_SERVICE_ROLE_KEY` | Oui | Client serveur standard | Conserver, puis vérifier qu’elle correspond à `SUPABASE_URL`. |
| `VITE_SUPABASE_URL` | Oui | Client navigateur | Conserver ; cette variable est intégrée au build. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Oui | Client navigateur | Conserver ; ne pas utiliser une clé service côté navigateur. |

Les valeurs doivent être saisies dans Railway depuis les paramètres sécurisés du projet. Il ne faut ni les commiter dans Git ni les insérer dans un script public. Les variables préfixées par `VITE_` sont accessibles au code client ; les clés de rôle service ne doivent jamais recevoir ce préfixe.[1]

## 3. Vérification Supabase et données réellement disponibles

L’audit a utilisé le client externe configuré localement, en lecture seule, avec l’en-tête compatible avec le format de clé Supabase actuel. La connexion au projet `zpkfwsczrtadrhcounof.supabase.co` a réussi.

| Indicateur lu | Résultat |
|---|---:|
| Commandes travaux totales | 65 |
| Commandes actives (`actif = true`) | 65 |
| Commandes archivées (`actif = false`) | 0 |
| Tranches actives | 120 |
| Imports récents visibles | 7 |
| Fichier d’import récent | `Suivi_Travaux_Secteur_ER_HCHEDLY_2023.xlsx` |
| Lignes déclarées par import | 93 |
| Créations / modifications sur les quatre derniers imports | 0 / 0 |
| Erreurs sur deux imports plus anciens du même jour | 27 puis 17 |

Ces résultats montrent que **Supabase répond** et que les 65 commandes actuellement présentes sont toutes visibles pour les requêtes du dashboard, à condition que le serveur soit fonctionnel. Ils ne prouvent pas une suppression de données dans le dernier état : aucune commande n’est actuellement marquée archivée.

L’écart entre les **93 lignes** du fichier et les **65 commandes** présentes mérite toutefois vérification métier. Il peut correspondre à des doublons, à des lignes non importables ou à des lignes dont l’identifiant de commande existe déjà. Les derniers imports affichent zéro création et zéro modification, ce qui est cohérent avec la réimportation d’un fichier inchangé, mais l’historique des imports ne conserve pas le compteur `inchangees` retourné par le traitement par lots. On ne peut donc pas conclure, avec les seules tables actuelles, combien de lignes du fichier ont été effectivement reconnues comme inchangées.

## 4. Incompatibilités de schéma détectées

Trois colonnes référencées par le code sont absentes de la base de production. Chaque vérification a renvoyé le code PostgreSQL `42703` (« column does not exist »).

| Table | Colonne absente | Effet dans le code |
|---|---|---|
| `import_travaux` | `annee_exercice` | L’année de l’import ne peut pas être enregistrée. Le code masque l’échec au lieu de l’arrêter. |
| `travaux_commandes` | `annee_exercice` | Toute création ou modification effective contenant cette colonne peut échouer. Les imports sans changement peuvent masquer le problème. |
| `travaux_commandes_historique` | `resolu` | Le dashboard tente un repli de lecture ; la fonction de résolution, elle, ne peut pas fonctionner correctement. |

La présence de ces références dans les types et dans les fonctions d’import, sans migration correspondante dans la base, est une cause plausible des erreurs sur les imports antérieurs. C’est un constat technique solide ; l’attribution précise des 27 et 17 erreurs exigerait toutefois les réponses détaillées du lot concerné ou les anciens logs applicatifs.

> La documentation Nitro recommande un préréglage Node pour produire un serveur Node exécutable ; les préréglages peuvent être imposés par `NITRO_PRESET` ou `SERVER_PRESET`.[2]

## 5. Risque de « données manquantes » lors des imports

La fonction `finalizeTravauxImport` compare **toutes** les commandes actuellement actives aux lignes rencontrées dans le dernier import. Toute commande active non vue dans cet import est ensuite passée à `actif = false`. Comme le dashboard ne charge que `actif = true`, ces commandes disparaissent de l’interface.

Cela signifie qu’un import partiel, un export filtré par secteur ou un fichier limité à une année peut faire disparaître des commandes auparavant visibles. Au moment de l’audit, ce mécanisme n’a pas laissé de commandes archivées, mais il reste un risque majeur pour le prochain import.

| Risque | Niveau | Mesure recommandée |
|---|---:|---|
| Import partiel archive des commandes hors fichier | Critique | Désactiver l’archivage automatique ou le limiter au même périmètre métier. |
| Année d’exercice absente du schéma | Élevé | Ajouter les colonnes avant le prochain import. |
| Régression non détectée par l’utilisateur | Élevé | Prévisualiser le nombre de lignes à archiver et exiger une confirmation explicite. |
| Historique sans statut de résolution | Moyen | Ajouter `resolu` avec une valeur par défaut puis vérifier l’interface de résolution. |

## 6. Plan de correction recommandé

### Étape A — sécuriser les données avant action

Suspendre les imports de travaux. Effectuer une sauvegarde Supabase ou un export des tables `travaux_commandes`, `travaux_commandes_historique` et `import_travaux`. Ensuite, vérifier avec les responsables métier si les 65 commandes correspondent bien au périmètre attendu du fichier 2023.

### Étape B — mettre le schéma en cohérence

Après validation dans un environnement de test ou une sauvegarde, appliquer une migration contrôlée équivalente à la suivante :

```sql
alter table public.import_travaux
  add column if not exists annee_exercice integer;

alter table public.travaux_commandes
  add column if not exists annee_exercice integer;

alter table public.travaux_commandes_historique
  add column if not exists resolu boolean not null default false;
```

Cette migration doit être exécutée dans l’éditeur SQL Supabase ou par un flux de migrations versionné, puis validée avec un import test. Il faudra également mettre à jour les types Supabase générés, sinon le code TypeScript restera incohérent avec la base.

### Étape C — corriger l’algorithme d’archivage

Remplacer l’archivage global par un archivage borné au périmètre de l’import, par exemple par année, secteur ou source identifiée. Une approche sûre consiste à calculer et afficher la liste des commandes qui seraient archivées, puis à demander une confirmation explicite avant écriture. Le traitement doit aussi refuser d’archiver si le fichier semble anormalement petit au regard du dernier import comparable.

### Étape D — réparer le build serveur

La configuration Railway doit être changée pour exécuter le serveur TanStack Start, en suivant le modèle Node documenté par Railway.[1] Une option robuste consiste à utiliser un Dockerfile, avec une image qui lance :

```bash
node .output/server/index.mjs
```

Le build doit être réalisé avec un préréglage Node explicite, par exemple `NITRO_PRESET=node-server`. Toutefois, **ne pas déployer ce changement seul** : l’essai local révèle d’abord l’erreur SSR `__exportAll is not a function`.

Il faut donc stabiliser l’empaquetage SSR, notamment en alignant les versions de `@tanstack/react-start`, `@tanstack/router-plugin`, `@tanstack/react-router` et de la configuration Lovable avec une combinaison officiellement compatible. Après correction, la validation minimale est : build Node, démarrage avec `PORT`, réponse HTTP 200 de `/`, puis test de `/dashboard-travaux`.

### Étape E — compléter les variables Railway et valider

Ajouter à Railway, dans le service concerné, les variables serveur `EXT_SUPABASE_URL` et `EXT_SUPABASE_SERVICE_ROLE_KEY` à partir des paramètres existants de Supabase. Ajouter aussi `SUPABASE_URL` si les routes utilisant le client standard sont activées. Après le redéploiement, vérifier dans cet ordre :

1. la racine du domaine répond en HTTP 200 ;
2. le dashboard appelle ses fonctions serveur sans erreur de variable manquante ;
3. les 65 commandes et les 120 tranches sont visibles ;
4. un import de test ne provoque aucune écriture d’archivage inattendue ;
5. les colonnes `annee_exercice` et `resolu` sont exploitées sans erreur SQL.

## Références

[1]: https://docs.railway.com/guides/tanstack-start "Railway — Deploy a TanStack Start App"
[2]: https://nitro.build/deploy "Nitro — Deploy"
[3]: https://github.com/Hamedchedly/lot-watcher-pro "Dépôt GitHub privé lot-watcher-pro"
