create table if not exists public.import_travaux (
  id uuid primary key default gen_random_uuid(),
  fichier text not null,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'termine', 'erreur')),
  lignes integer not null default 0,
  doublons integer not null default 0,
  creees integer not null default 0,
  modifiees integer not null default 0,
  inchangees integer not null default 0,
  archivees integer not null default 0,
  ignorees integer not null default 0,
  erreurs integer not null default 0,
  demarre_at timestamptz not null default now(),
  termine_at timestamptz
);

create table if not exists public.travaux_commandes (
  id uuid primary key default gen_random_uuid(),
  numero_commande text not null unique,
  secteur text,
  tranche_code text references public.tranches(code),
  lot_code text references public.lots(code_patrimoine),
  batiment text,
  charge_clientele text,
  adresse text,
  nature_analytique text,
  corps_etat text,
  charge_operation text,
  ligne_budget text,
  descriptif text,
  budget numeric,
  numero_fournisseur text,
  fournisseur text,
  etat_commande text,
  engage numeric,
  ecart numeric,
  paye numeric,
  solde numeric,
  etat_travaux text,
  date_demarrage date,
  date_fin_travaux date,
  observations text,
  support_communication text,
  date_communication date,
  actif boolean not null default true,
  vu_dans_import_id uuid references public.import_travaux(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travaux_commandes_historique (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.import_travaux(id),
  commande_id uuid not null references public.travaux_commandes(id),
  operation text not null check (operation in ('creation', 'modification', 'archivage')),
  avant jsonb,
  apres jsonb,
  created_at timestamptz not null default now()
);

create index if not exists travaux_commandes_tranche_idx on public.travaux_commandes(tranche_code);
create index if not exists travaux_commandes_lot_idx on public.travaux_commandes(lot_code);
create index if not exists travaux_commandes_statut_idx on public.travaux_commandes(etat_commande, actif);
create index if not exists travaux_commandes_import_idx on public.travaux_commandes(vu_dans_import_id);
create index if not exists travaux_commandes_historique_commande_idx on public.travaux_commandes_historique(commande_id, created_at desc);

grant select on public.import_travaux to anon, authenticated;
grant all on public.import_travaux to service_role;
grant select on public.travaux_commandes to anon, authenticated;
grant all on public.travaux_commandes to service_role;
grant select on public.travaux_commandes_historique to anon, authenticated;
grant all on public.travaux_commandes_historique to service_role;

alter table public.import_travaux enable row level security;
alter table public.travaux_commandes enable row level security;
alter table public.travaux_commandes_historique enable row level security;

drop policy if exists "lecture publique imports travaux" on public.import_travaux;
create policy "lecture publique imports travaux" on public.import_travaux for select using (true);
drop policy if exists "lecture publique commandes travaux" on public.travaux_commandes;
create policy "lecture publique commandes travaux" on public.travaux_commandes for select using (true);
drop policy if exists "lecture publique historique travaux" on public.travaux_commandes_historique;
create policy "lecture publique historique travaux" on public.travaux_commandes_historique for select using (true);

create or replace function public.set_travaux_commandes_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists travaux_commandes_updated_at on public.travaux_commandes;
create trigger travaux_commandes_updated_at before update on public.travaux_commandes
for each row execute function public.set_travaux_commandes_updated_at();