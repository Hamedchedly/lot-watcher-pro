# 🛠 Récapitulatif des Modifications - Lot Watcher Pro

Ce document détaille l'ensemble des fonctionnalités et corrections apportées au projet pour transformer le dashboard travaux en un outil de pilotage patrimonial complet.

## 📈 Dashboard Travaux "Pro V6"

### 1. Visualisations & Cartographie
- **Carte Interactive Leaflet** : Intégration d'une véritable carte épurée avec marqueurs par ville.
- **Basculement Map/Heatmap** : Bouton permettant de passer de la vue carte à une vue heatmap avec barres de progression par ville.
- **Graphiques Dynamiques** :
    - **Donut Chart** : Répartition par Type (GT/GE/CP) avec **drill-down interactif** (clic pour voir le détail par corps d'état).
    - **Bar Chart Tranches** : Classement Top 5/20 avec affichage des montants et adresses au survol.

### 2. Filtrage Avancé & Ergonomie
- **Slider Temporel** : Sélection de plage d'années par double curseur.
- **Bouton "Dernière Année"** : Filtre instantané sur l'année la plus récente des données.
- **Multi-sélection Enrichie** : Filtres Tranches (avec Rue/Ville) et Villes avec recherche intégrée.
- **Filtres d'En-tête** : Tri et filtrage par plage de prix (min/max) directement depuis les colonnes du tableau.
- **Largeur Optimisée** : Passage en plein écran (`max-w-full`) pour afficher toutes les colonnes sans perte d'information.

### 3. Gestion des Commandes & Édition
- **Fiche Commande 2.0** :
    - Affichage du descriptif complet en haut de fiche.
    - **Mode Édition Directe** : Possibilité de modifier tous les champs (Descriptif, Type, Adresse, Montants, ID Lot).
    - **Rattachement Patrimoine** : Ajout du champ **ID Lot** pour lier une commande à un logement spécifique.
- **Journal Réorganisé** : Ordre des colonnes optimisé : `Année`, `N° Commande`, `Tranche`, `Adresse`, `Descriptif`, `Type`, `Entreprise`, `Engagé`, `Payé`, `Prog.`, `État`, `ACT.`.

### 4. Alertes & Historique (⚠️)
- **Résolution des Conflits** : Icône ⚠️ dans le journal pour les modifications détectées.
- **Modale de Comparaison** : Interface 2-panneaux pour comparer Version A (Original) vs Version B (Modifié).
- **Validation Persistante** : Une fois la décision prise ("Garder A" ou "Garder B"), l'alerte disparaît automatiquement du dashboard.

## 🌐 Interconnexion Patrimoine
- **Historique Travaux Complet** : Les fiches patrimoine (Tranches et Lots) intègrent désormais automatiquement toutes les commandes issues des imports Excel.
- **Navigation Transversale** : Liens directs entre le Dashboard Travaux et les pages Patrimoine via les codes Tranche et Lot.

## ⚙️ Moteur d'Importation
- **Gestion des En-têtes Complexes** : Support des fichiers Excel avec titres sur deux lignes (fusion intelligente).
- **Nettoyage Automatique** : Suppression des caractères parasites (ex: `'` devant les numéros de tranche).
- **Suivi des Erreurs** : Modale dédiée affichant le détail des lignes rejetées lors du dernier import.

## 🗄 Base de Données (Supabase)
- **Migration SQL incluse** (`20260810103000_add_annee_exercice.sql`) :
    - Ajout des colonnes `annee_exercice`, `classification_programmation`, `classification_secteur`.
    - Ajout de la colonne `resolu` dans la table historique pour la gestion des alertes.

---
*Développé avec soin pour une gestion patrimoniale optimisée.*
