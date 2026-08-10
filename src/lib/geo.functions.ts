import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Coordinates already cached in the database. */
export const getAdressesGeo = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
  const { data, error } = await supabaseAdmin
    .from("adresses_geo")
    .select("cle, adresse, ville, lat, lng, statut")
    .limit(5000);
  if (error) throw new Error(error.message);
  return data ?? [];
});

const inputSchema = z.object({
  items: z.array(z.object({ cle: z.string(), adresse: z.string(), ville: z.string() })).max(25),
});

/** Geocode a small batch of addresses and update the database cache. */
export const geocodeAdresses = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!mapsKey) throw new Error("GOOGLE_MAPS_API_KEY is missing");

    const { supabaseAdmin } = await import("@/integrations/supabase-ext/client.server");
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
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=fr&key=${encodeURIComponent(mapsKey)}`,
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Geocoding rejected [${res.status}]: ${body}`);
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
