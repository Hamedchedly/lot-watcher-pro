-- Migration de correction pour lot-watcher-pro
-- Ajout des colonnes manquantes dans import_travaux, travaux_commandes et travaux_commandes_historique

alter table if exists public.import_travaux
  add column if not exists annee_exercice integer;

alter table if exists public.travaux_commandes
  add column if not exists annee_exercice integer;

alter table if exists public.travaux_commandes_historique
  add column if not exists resolu boolean not null default false;
