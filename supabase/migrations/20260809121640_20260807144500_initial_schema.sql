CREATE TABLE public.tranches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  libelle text,
  localite text,
  copro_numero text,
  secteur text,
  sous_secteur text,
  quartier text,
  zone_edf text,
  zone_apl text,
  nb_logements integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  vu_le date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tranches TO anon, authenticated;
GRANT ALL ON public.tranches TO service_role;
ALTER TABLE public.tranches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture publique des tranches" ON public.tranches FOR SELECT USING (true);

CREATE TABLE public.lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_patrimoine text NOT NULL UNIQUE,
  tranche_code text NOT NULL REFERENCES public.tranches(code) ON UPDATE CASCADE,
  type_lot text,
  batiment text,
  etage text,
  porte text,
  surface_utile numeric,
  dpe text,
  date_dpe date,
  identifiant_insee text,
  individuel_collectif text,
  date_achevement_travaux date,
  adresse text,
  code_postal text,
  ville text,
  locataire_nom text,
  locataire_telephone text,
  locataire_email text,
  date_entree date,
  actif boolean NOT NULL DEFAULT true,
  vu_le date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lots_tranche_idx ON public.lots (tranche_code);
CREATE INDEX lots_ville_idx ON public.lots (ville);
CREATE INDEX lots_batiment_idx ON public.lots (tranche_code, batiment);
GRANT SELECT ON public.lots TO anon, authenticated;
GRANT ALL ON public.lots TO service_role;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture publique des lots" ON public.lots FOR SELECT USING (true);

CREATE TABLE public.occupants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_code text NOT NULL REFERENCES public.lots(code_patrimoine) ON UPDATE CASCADE ON DELETE CASCADE,
  nom text,
  prenom text,
  date_naissance date,
  date_entree date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lot_code, nom, prenom, date_naissance)
);
CREATE INDEX occupants_lot_idx ON public.occupants (lot_code);
GRANT SELECT ON public.occupants TO anon, authenticated;
GRANT ALL ON public.occupants TO service_role;
ALTER TABLE public.occupants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture publique des occupants" ON public.occupants FOR SELECT USING (true);

CREATE TABLE public.travaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niveau text NOT NULL DEFAULT 'lot',
  tranche_code text,
  batiment text,
  lot_code text,
  libelle text NOT NULL,
  statut text NOT NULL DEFAULT 'a_prevoir',
  date_travaux date,
  cout numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX travaux_tranche_idx ON public.travaux (tranche_code);
CREATE INDEX travaux_lot_idx ON public.travaux (lot_code);
GRANT SELECT ON public.travaux TO anon, authenticated;
GRANT ALL ON public.travaux TO service_role;
ALTER TABLE public.travaux ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture publique des travaux" ON public.travaux FOR SELECT USING (true);

CREATE TABLE public.imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fichier text,
  lignes integer NOT NULL DEFAULT 0,
  tranches_creees integer NOT NULL DEFAULT 0,
  lots_crees integer NOT NULL DEFAULT 0,
  lots_maj integer NOT NULL DEFAULT 0,
  lots_disparus integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.imports TO anon, authenticated;
GRANT ALL ON public.imports TO service_role;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture publique des imports" ON public.imports FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_tranches_updated BEFORE UPDATE ON public.tranches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lots_updated BEFORE UPDATE ON public.lots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_occupants_updated BEFORE UPDATE ON public.occupants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_travaux_updated BEFORE UPDATE ON public.travaux FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();