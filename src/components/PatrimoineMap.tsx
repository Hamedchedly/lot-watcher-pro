import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";

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
    const key = import.meta.env["VITE_GOOGLE_MAPS_BROWSER_KEY"];
    if (!key) return resolve();
    const channel = import.meta.env["VITE_GOOGLE_MAPS_CHANNEL"] ?? "";
    const s = document.createElement("script");
    s.id = "gmaps-js";
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initPatrimoineMap&channel=${channel}`;
    document.head.appendChild(s);
  });
}

/** Carte à deux niveaux : un pin par ville, puis les adresses exactes de la ville choisie. */
export function PatrimoineMap({ lots }: { lots: LotItem[] }) {
  const navigate = useNavigate({ from: "/" });
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [ville, setVille] = useState<string | null>(null);

  const fetchGeo = useServerFn(getAdressesGeo);
  const runGeocode = useServerFn(geocodeAdresses);
  const { data: geo, refetch } = useQuery({
    queryKey: ["adresses-geo"],
    queryFn: () => fetchGeo(),
  });

  const adresses = useMemo(() => {
    const map = new Map<
      string,
      { cle: string; adresse: string; ville: string; lots: number; tranches: Set<string> }
    >();
    for (const l of lots) {
      if (!l.adresse || !l.ville) continue;
      const adresse = entreeDe(l.adresse);
      const cle = cleAdresse(adresse, l.ville);
      const g = map.get(cle) ?? {
        cle,
        adresse,
        ville: l.ville,
        lots: 0,
        tranches: new Set<string>(),
      };
      g.lots += 1;
      g.tranches.add(l.tranche_code);
      map.set(cle, g);
    }
    return [...map.values()];
  }, [lots]);

  const connues = useMemo(() => new Map((geo ?? []).map((g) => [g.cle, g])), [geo]);
  const manquantes = useMemo(
    () => adresses.filter((a) => !connues.has(a.cle)),
    [adresses, connues],
  );

  // Agrégat par ville : barycentre des adresses localisées.
  const villes = useMemo(() => {
    const map = new Map<
      string,
      {
        ville: string;
        adresses: number;
        lots: number;
        tranches: Set<string>;
        lat: number;
        lng: number;
        n: number;
      }
    >();
    for (const a of adresses) {
      const point = connues.get(a.cle);
      const g = map.get(a.ville) ?? {
        ville: a.ville,
        adresses: 0,
        lots: 0,
        tranches: new Set<string>(),
        lat: 0,
        lng: 0,
        n: 0,
      };
      g.adresses += 1;
      g.lots += a.lots;
      a.tranches.forEach((t) => g.tranches.add(t));
      if (point?.lat && point?.lng) {
        g.lat += point.lat;
        g.lng += point.lng;
        g.n += 1;
      }
      map.set(a.ville, g);
    }
    return [...map.values()].filter((v) => v.n > 0);
  }, [adresses, connues]);

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
      const items = manquantes
        .slice(0, 25)
        .map(({ cle, adresse, ville }) => ({ cle, adresse, ville }));
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
    if (!infoRef.current) infoRef.current = new g.maps.InfoWindow();

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    infoRef.current.close();

    const bounds = new g.maps.LatLngBounds();
    let n = 0;

    if (!ville) {
      for (const v of villes) {
        const position = { lat: v.lat / v.n, lng: v.lng / v.n };
        const marker = new g.maps.Marker({
          position,
          map: mapRef.current,
          title: `${v.ville} — ${v.adresses} adresses · ${v.lots} lots`,
          label: { text: String(v.adresses), color: "#ffffff", fontSize: "11px" },
        });
        marker.addListener("click", () => setVille(v.ville));
        markersRef.current.push(marker);
        bounds.extend(position);
        n += 1;
      }
    } else {
      for (const a of adresses.filter((a) => a.ville === ville)) {
        const point = connues.get(a.cle);
        if (!point?.lat || !point?.lng) continue;
        const position = { lat: point.lat, lng: point.lng };
        const marker = new g.maps.Marker({
          position,
          map: mapRef.current,
          title: `${a.adresse} — ${a.lots} lots`,
          label: { text: String(a.lots), color: "#ffffff", fontSize: "11px" },
        });
        marker.addListener("click", () => {
          void navigate({
            to: "/adresses",
            search: {
              q: "",
              ville: a.ville,
              tranche: undefined,
              rue: undefined,
              adresse: a.adresse,
            },
          });
        });
        markersRef.current.push(marker);
        bounds.extend(position);
        n += 1;
      }
    }

    if (n > 1) mapRef.current.fitBounds(bounds);
    else if (n === 1) {
      mapRef.current.setCenter(bounds.getCenter());
      mapRef.current.setZoom(15);
    }
  }, [ready, adresses, connues, navigate, villes, ville]);

  const placees = adresses.filter((a) => connues.get(a.cle)?.lat).length;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-panel">
      <div className="relative">
        <div ref={divRef} className="h-[420px] w-full bg-muted" />
        {ville && (
          <button
            onClick={() => setVille(null)}
            className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg border bg-card px-3 py-2 text-xs font-medium shadow-panel transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-4" /> Toutes les villes
          </button>
        )}
      </div>
      <p className="border-t p-3 text-xs text-muted-foreground">
        {ville
          ? `${ville} · adresses détaillées`
          : `${villes.length} villes · ${placees} adresses localisées sur ${adresses.length}`}
        {manquantes.length > 0 && " · localisation des adresses restantes en cours…"}
      </p>
    </div>
  );
}
