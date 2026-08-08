import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Coordonnées déjà géocodées (cache en base). */
export const getAdressesGeo = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("adresses_geo")
    .select("cle, adresse, ville, lat, lng, statut")
    .limit(5000);
  if (error) throw new Error(error.message);
  return data ?? [];
});

const inputSchema = z.object({
  items: z
    .array(z.object({ cle: z.string(), adresse: z.string(), ville: z.string() }))
    .max(25),
});

/** Géocode un petit lot d'adresses via Google Maps et met le cache à jour. */
export const geocodeAdresses = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lovableKey || !mapsKey) throw new Error("Connecteur Google Maps non configuré");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows: Array<{
      cle: string;
      adresse: string;
      ville: string;
      lat: number | null;
      lng: number | null;
      statut: string;
    }> = [];

    for (const item of data.items) {
      const query = `${item.adresse}, ${item.ville}, France`;
      const res = await fetch(
        `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=fr`,
        {
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": mapsKey,
          },
        },
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Géocodage refusé [${res.status}]: ${body}`);
      }
      const json = (await res.json()) as {
        status: string;
        results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
      };
      const loc = json.results?.[0]?.geometry.location;
      rows.push({
        cle: item.cle,
        adresse: item.adresse,
        ville: item.ville,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
        statut: loc ? "ok" : json.status || "ZERO_RESULTS",
      });
    }

    if (rows.length) {
      const { error } = await supabaseAdmin
        .from("adresses_geo")
        .upsert(rows, { onConflict: "cle" });
      if (error) throw new Error(error.message);
    }

    return rows;
  });
