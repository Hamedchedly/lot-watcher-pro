-- Rapport d'import Travaux cliquable — table de détail immuable des résultats d'import
--
-- Table           : travaux_import_details
-- Type            : uuid (id), import_id (FK cascade), type (enum), commande_id (FK set null),
--                   numero_commande, lot_code, annee_exercice, ligne, message, details jsonb,
--                   created_at
-- Index           : (import_id, type) pour l'interrogation par catégorie
-- RLS             : accès UNIQUEMENT via les server functions (service_role, BYPASS RLS).
--                   Aucune policy, aucun privilège anon/authenticated : les détails d'import
--                   (montants, fournisseurs, adresses, versions) ne sont pas lisibles via l'API
--                   REST. service_role conserve `grant all`.
--
-- NB : les détails sont écrits AU MOMENT de l'import (snapshot immuable), jamais reconstruits.

create table if not exists public.travaux_import_details (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null
    references public.import_travaux(id)
    on delete cascade,
  type text not null
    check (
      type in (
        'creee',
        'conflit',
        'inchangee',
        'archivee',
        'doublon',
        'ignoree',
        'erreur'
      )
    ),
  commande_id uuid
    references public.travaux_commandes(id)
    on delete set null,
  numero_commande text,
  lot_code text,
  annee_exercice integer,
  ligne integer,
  message text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists travaux_import_details_import_type_idx
  on public.travaux_import_details(import_id, type);

-- Accès exclusivement via les server functions (service_role, BYPASS RLS).
-- Les détails d'import (montants, fournisseurs, adresses, versions) ne doivent pas être
-- lisibles via l'API REST par anon/authenticated : aucune policy n'est créée et les
-- privilèges éventuels par défaut de Supabase sont révoqués explicitement.
grant all on public.travaux_import_details to service_role;

revoke all on public.travaux_import_details from anon, authenticated;

alter table public.travaux_import_details enable row level security;
