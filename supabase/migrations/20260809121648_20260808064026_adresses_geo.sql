CREATE TABLE public.adresses_geo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cle text NOT NULL UNIQUE,
  adresse text NOT NULL,
  ville text NOT NULL,
  lat double precision,
  lng double precision,
  statut text NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.adresses_geo TO anon;
GRANT SELECT ON public.adresses_geo TO authenticated;
GRANT ALL ON public.adresses_geo TO service_role;

ALTER TABLE public.adresses_geo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique des coordonnees" ON public.adresses_geo FOR SELECT USING (true);

CREATE TRIGGER trg_adresses_geo_updated BEFORE UPDATE ON public.adresses_geo
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();