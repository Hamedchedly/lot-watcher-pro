-- Rapport d'import Travaux cliquable — table de détail immuable des résultats d'import
--
-- Table           : travaux_import_details
-- Type            : uuid (id), import_id (FK cascade), type (enum), commande_id (FK set null),
--                   numero_commande, lot_code, annee_exercice, ligne, message, details jsonb,
--                   created_at
-- Index           : (import_id, type) pour l'interrogation par catégorie
-- RLS             : alignée sur la convention la plus récente de la famille travaux
--                   (migration 20260810101810) : lecture publique via anon/authenticated,
--                   accès complet via service_role. Les lectures applicatives passent par le
--                   service role (bypass RLS) ; la policy publique sert aux accès REST.
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

grant select on public.travaux_import_details to anon, authenticated;
grant all on public.travaux_import_details to service_role;

alter table public.travaux_import_details enable row level security;

drop policy if exists "lecture publique details imports travaux" on public.travaux_import_details;
create policy "lecture publique details imports travaux"
  on public.travaux_import_details
  for select
  using (true);
