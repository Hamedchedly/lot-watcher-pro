-- Référentiel géographique des villes du Dashboard Travaux.
--
-- La carte du dashboard lit UNIQUEMENT cette table (via getVillesGeo).
-- Le cache d'adresses `adresses_geo` reste réservé au module /adresses.
--
-- 30 villes validées (audit du 2026-08-11) :
--   188 commandes → 30 villes (28 via tranches.localite + NANDY + SOUPPES-SUR-LOING
--   issues des 6 commandes sans tranche, ville détectée dans l'adresse d'import).
-- Coordonnées = centre de la commune (OSM/Nominatim). Aucun géocodage au runtime.

create table if not exists public.villes_geo (
  id uuid primary key default gen_random_uuid(),
  ville text not null,
  ville_normalisee text not null unique,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.villes_geo is
  'Référentiel des villes du Dashboard Travaux (centres communaux, 30 villes).';

insert into public.villes_geo (ville, ville_normalisee, lat, lng) values
  ('CHESSY',                 'CHESSY',                 48.879879, 2.765836),
  ('SERRIS',                 'SERRIS',                 48.856700, 2.785562),
  ('VARREDDES',              'VARREDDES',              49.003993, 2.926945),
  ('MAGNY-LE-HONGRE',        'MAGNY LE HONGRE',        48.863116, 2.813526),
  ('OZOIR-LA-FERRIERE',      'OZOIR LA FERRIERE',      48.762090, 2.671942),
  ('VAUJOURS',               'VAUJOURS',               48.930256, 2.569192),
  ('PARIS 20',               'PARIS 20',               48.865042, 2.398929),
  ('VILLENEUVE-SAINT-DENIS', 'VILLENEUVE SAINT DENIS', 48.815721, 2.793709),
  ('VILLENOY',               'VILLENOY',               48.941218, 2.859655),
  ('COUPVRAY',               'COUPVRAY',               48.891898, 2.794814),
  ('CHAUMES-EN-BRIE',        'CHAUMES EN BRIE',        48.664775, 2.842398),
  ('THORIGNY-SUR-MARNE',     'THORIGNY SUR MARNE',     48.884186, 2.711574),
  ('OTHIS',                  'OTHIS',                  49.077997, 2.670556),
  ('NANGIS',                 'NANGIS',                 48.554942, 3.013684),
  ('LE PLESSIS-TREVISE',     'LE PLESSIS TREVISE',     48.809153, 2.573262),
  ('VILLEPINTE',             'VILLEPINTE',             48.963657, 2.534754),
  ('MONTEVRAIN',             'MONTEVRAIN',             48.874129, 2.748344),
  ('MEAUX',                  'MEAUX',                  48.958271, 2.877354),
  ('CHOISY-LE-ROI',          'CHOISY LE ROI',          48.763024, 2.409366),
  ('DAMMARTIN-EN-GOELE',     'DAMMARTIN EN GOELE',     49.054776, 2.683568),
  ('SOUPPES-SUR-LOING',      'SOUPPES SUR LOING',      48.186806, 2.742667),
  ('VALENTON',               'VALENTON',               48.744319, 2.469974),
  ('CHAMPS-SUR-MARNE',       'CHAMPS SUR MARNE',       48.852689, 2.602722),
  ('NANDY',                  'NANDY',                  48.581364, 2.564017),
  ('CHELLES',                'CHELLES',                48.878380, 2.590549),
  ('PONTAULT-COMBAULT',      'PONTAULT COMBAULT',      48.800913, 2.606806),
  ('SEVRAN',                 'SEVRAN',                 48.937634, 2.529816),
  ('SUCY-EN-BRIE',           'SUCY EN BRIE',           48.771132, 2.522128),
  ('CROISSY-BEAUBOURG',      'CROISSY BEAUBOURG',      48.827873, 2.658402),
  ('LOGNES',                 'LOGNES',                 48.838416, 2.632722)
on conflict (ville_normalisee) do nothing;
