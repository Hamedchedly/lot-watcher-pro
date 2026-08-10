alter table public.import_travaux add column if not exists annee_exercice integer;
alter table public.travaux_commandes add column if not exists annee_exercice integer;
alter table public.travaux_commandes add column if not exists classification_programmation text;
alter table public.travaux_commandes add column if not exists classification_secteur text;
