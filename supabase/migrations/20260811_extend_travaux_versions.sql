-- Correction Import Travaux — conflits de version, archivage par année, journal des imports
--
-- 1) travaux_commandes_historique.operation
--    Étend la contrainte existante (creation, modification, archivage) aux opérations
--    « conflit » (version en attente de décision) et « resolution » (décision utilisateur).
--    Ces deux opérations sont écrites par importTravauxBatch / resolveHistoriqueTravaux.
--
-- 2) import_travaux.conflits
--    Compteur de conflits détectés pendant un import, persistant dans le journal des imports.
--    (integer, non nul, défaut 0)
--
-- 3) Index
--    - travaux_commandes(annee_exercice, actif) : accélère l'archivage annuel de finalizeTravauxImport.
--    - travaux_commandes_historique(operation, resolu) : accélère les alertes du journal.

alter table public.travaux_commandes_historique
  drop constraint if exists travaux_commandes_historique_operation_check;

alter table public.travaux_commandes_historique
  add constraint travaux_commandes_historique_operation_check
  check (operation in ('creation', 'modification', 'archivage', 'conflit', 'resolution'));

alter table public.import_travaux
  add column if not exists conflits integer not null default 0;

create index if not exists travaux_commandes_annee_actif_idx
  on public.travaux_commandes(annee_exercice, actif);

create index if not exists travaux_commandes_historique_resolution_idx
  on public.travaux_commandes_historique(operation, resolu);
