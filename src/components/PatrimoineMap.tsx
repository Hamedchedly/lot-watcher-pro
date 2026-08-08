import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAdressesGeo, geocodeAdresses } from "@/lib/geo.functions";
import { cleAdresse, entreeDe, type LotItem } from "@/lib/adresses";

declare global {
  interface Window {
    __initPatrimoineMap?: () => void;
    google?: any;
  }
}

function loadMapsApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.Map) return Promise.resolve();
  const existing = document.getElementById("gmaps-js") as HTMLScriptElement | null;
  return new Promise((resolve) => {
    window.__initPatrimoineMap = () => resolve();
    if (existing) return;
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "";
    const s = document.createElement("script");
    s.id = "gmaps-js";
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initPatrimoineMap&channel=${channel}`;
    document.head.appendChild(s);
  });
}

/** Carte des adresses du patrimoine, avec géocodage progressif mis en cache. */
export function PatrimoineMap({ lots }: { lots: LotItem[] }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);

  const fetchGeo = useServerFn(getAdressesGeo);
  const runGeocode = useServerFn(geocodeAdresses);
  const { data: geo, refetch } = useQuery({
    queryKey: ["adresses-geo"],
    queryFn: () => fetchGeo(),
  });

  const adresses = useMemo(() => {
    const map = new Map<string, { cle: string; adresse: string; ville: string; lots: number }>();
    for (const l of lots) {
      if (!l.adresse || !l.ville) continue;
      const adresse = entreeDe(l.adresse);
      const cle = cleAdresse(adresse, l.ville);
      const g = map.get(cle) ?? { cle, adresse, ville: l.ville, lots: 0 };
      g.lots += 1;
      map.set(cle, g);
    }
    return [...map.values()];
  }, [lots]);

  const connues = useMemo(() => new Map((geo ?? []).map((g) => [g.cle, g])), [geo]);
  const manquantes = useMemo(
    () => adresses.filter((a) => !connues.has(a.cle)),
    [adresses, connues],
  );

  useEffect(() => {
    let cancelled = false;
    loadMapsApi().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Géocodage progressif : un lot de 25 adresses à la fois, résultat mis en cache en base.
  useEffect(() => {
    if (!geo || manquantes.length === 0) return;
    let cancelled = false;
    (async () => {
      const items = manquantes.slice(0, 25).map(({ cle, adresse, ville }) => ({ cle, adresse, ville }));
      try {
        await runGeocode({ data: { items } });
        if (!cancelled) await refetch();
      } catch {
        /* on réessaiera au prochain chargement */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geo, manquantes, runGeocode, refetch]);

  useEffect(() => {
    if (!ready || !divRef.current || !window.google?.maps) return;
    const g = window.google;
    if (!mapRef.current) {
      mapRef.current = new g.maps.Map(divRef.current, {
        center: { lat: 48.84, lng: 2.75 },
        zoom: 9,
        mapTypeControl: false,
        streetViewControl: false,
      });
    }

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new g.maps.LatLngBounds();
    let n = 0;
    for (const a of adresses) {
      const point = connues.get(a.cle);
      if (!point?.lat || !point?.lng) continue;
      const position = { lat: point.lat, lng: point.lng };
      const marker = new g.maps.Marker({
        position,
        map: mapRef.current,
        title: `${a.adresse} — ${a.ville} (${a.lots} lots)`,
      });
      markersRef.current.push(marker);
      bounds.extend(position);
      n += 1;
    }
    if (n > 0) mapRef.current.fitBounds(bounds);
  }, [ready, adresses, connues]);

  const placees = adresses.filter((a) => connues.get(a.cle)?.lat).length;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-panel">
      <div ref={divRef} className="h-[420px] w-full bg-muted" />
      <p className="border-t p-3 text-xs text-muted-foreground">
        {placees} adresses localisées sur {adresses.length}
        {manquantes.length > 0 && " · localisation des adresses restantes en cours…"}
      </p>
    </div>
  );
}
