import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { getAdressesGeo, geocodeAdresses } from "@/lib/geo.functions";
import { getPatrimoine } from "@/lib/isis.functions";
import { cleAdresse, entreeDe, type LotItem } from "@/lib/adresses";
import {
  agregerPatrimoineHome,
  adressesDeVille,
  type AdressesGeoApercu,
} from "@/components/PatrimoineHomeMap";

/** Teinte HSL : 60 = jaune (peu de lots), 0 = rouge (beaucoup de lots). */
function colorFor(t: number) {
  const hue = Math.round((1 - Math.min(1, Math.max(0, t))) * 60);
  return `hsl(${hue}, 90%, 50%)`;
}

const pluriel = (n: number, s: string) => `${n} ${s}${n > 1 ? "s" : ""}`;

/** Zoom automatique sur l'étendue des points (même mécanique que la carte du Dashboard). */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0]!, 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [42, 42] });
  }, [map, points]);
  return null;
}

/**
 * Carte Leaflet du patrimoine de la PAGE D'ACCUEIL — même style que la carte du Dashboard
 * (Leaflet + OpenStreetMap, cercles colorés par ville). Deux niveaux :
 * - Niveau 1 : UN cercle par VILLE (barycentre des adresses localisées), rayon et couleur
 *   proportionnels au nombre de lots ; clic → zoom sur la ville (niveau 2).
 * - Niveau 2 : UN petit cercle par ADRESSE localisée ; clic → fiche de la ville dans /adresses.
 *   Bouton « ← Toutes les villes » pour revenir.
 * Les garages (estGarage) sont comptés séparément, jamais dans `lots`.
 * Les villes/adresses sans coordonnées sont comptées, jamais déplacées ni inventées.
 * Ce module est chargé uniquement côté client (react-leaflet est incompatible avec le SSR).
 */
export default function PatrimoineHomeMapLeaflet({ lots }: { lots?: LotItem[] | undefined }) {
  const navigate = useNavigate({ from: "/" });
  const [ville, setVille] = useState<string | null>(null);
  // Popup actuellement ouvert (permet « 1er survol/clic → infos, clic suivant → action »).
  const [selectedVille, setSelectedVille] = useState<string | null>(null);
  const [selectedAdresse, setSelectedAdresse] = useState<string | null>(null);

  // Changement de niveau (ville ⇄ adresses) → réinitialise la sélection des popups.
  useEffect(() => {
    setSelectedVille(null);
    setSelectedAdresse(null);
  }, [ville]);

  // Lots : prop fournie par la page (déjà chargés via ["patrimoine"]) sinon fetch partagé.
  const fetchPatrimoine = useServerFn(getPatrimoine);
  const { data: dataPatrimoine } = useQuery({
    queryKey: ["patrimoine"],
    queryFn: () => fetchPatrimoine(),
  });
  const lotsEffectifs = lots ?? ((dataPatrimoine?.lots ?? []) as LotItem[]);

  // Coordonnées des adresses (cache adresses_geo, jamais un appel par adresse).
  const fetchGeo = useServerFn(getAdressesGeo);
  const runGeocode = useServerFn(geocodeAdresses);
  const { data: geo, refetch } = useQuery({
    queryKey: ["adresses-geo"],
    queryFn: () => fetchGeo(),
  });

  const connues = useMemo(
    () => new Map<string, AdressesGeoApercu>((geo ?? []).map((g) => [g.cle, g])),
    [geo],
  );

  // Toutes les adresses du patrimoine (adresse + ville), dédupliquées par clé.
  const toutesLesAdresses = useMemo(() => {
    const map = new Map<string, { cle: string; adresse: string; ville: string }>();
    for (const l of lotsEffectifs) {
      if (!l.adresse || !l.ville) continue;
      const adresse = entreeDe(l.adresse);
      const cle = cleAdresse(adresse, l.ville);
      if (!map.has(cle)) map.set(cle, { cle, adresse, ville: l.ville });
    }
    return [...map.values()];
  }, [lotsEffectifs]);

  // Adresses sans coordonnées valides dans le cache (à géocoder).
  const manquantes = useMemo(
    () =>
      toutesLesAdresses.filter((a) => {
        const g = connues.get(a.cle);
        return !g?.lat || !g?.lng;
      }),
    [toutesLesAdresses, connues],
  );

  const { villes, adresses, nonGeolocaliseesAdresses, villesNonLocalisees } = useMemo(
    () => agregerPatrimoineHome(lotsEffectifs, geo ?? []),
    [lotsEffectifs, geo],
  );

  // Si la ville sélectionnée disparaît des données → retour au niveau 1.
  useEffect(() => {
    if (ville && !villes.some((v) => v.ville === ville)) setVille(null);
  }, [ville, villes]);

  const adressesVille = useMemo(
    () => (ville ? adressesDeVille(adresses, ville) : []),
    [adresses, ville],
  );

  // Plus grand nombre de lots d'une ville (base du dégradé de couleurs).
  const max = useMemo(() => Math.max(0, ...villes.map((v) => v.lots + v.garages)), [villes]);

  // Géocodage progressif (même mécanisme que /adresses) : un lot de 25 adresses à la fois,
  // résultat mis en cache en base, puis rechargement du cache jusqu'à épuisement.
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

  const pointsVilles = useMemo(
    () => villes.map((v) => [v.lat / v.n, v.lng / v.n] as [number, number]),
    [villes],
  );
  const pointsAdresses = useMemo(
    () =>
      adressesVille
        .map((a) => {
          const p = connues.get(a.cle);
          return p?.lat && p?.lng ? ([p.lat, p.lng] as [number, number]) : null;
        })
        .filter((p): p is [number, number] => p !== null),
    [adressesVille, connues],
  );
  const points = ville ? pointsAdresses : pointsVilles;

  const placees = adresses.length;
  const nonGeolocalisees = ville ? 0 : nonGeolocaliseesAdresses;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-panel">
      <div className="relative h-[420px] w-full">
        <MapContainer
          center={[48.8566, 2.3522]}
          zoom={9}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds points={points} />
          {ville ? (
            adressesVille.map((a) => {
              const point = connues.get(a.cle);
              if (!point?.lat || !point?.lng) return null;
              return (
                <CircleMarker
                  key={a.cle}
                  center={[point.lat, point.lng]}
                  radius={7}
                  pathOptions={{
                    fillColor: "#2563eb",
                    fillOpacity: 0.9,
                    color: "rgba(15, 23, 42, 0.55)",
                    weight: 1.5,
                  }}
                  eventHandlers={{
                    mouseover: (e) => (e.target as L.CircleMarker).openPopup(),
                    mouseout: (e) => (e.target as L.CircleMarker).closePopup(),
                    click: () => {
                      // 2e clic (popup déjà ouverte) → fiche de l'adresse dans /adresses.
                      if (selectedAdresse === a.cle) {
                        void navigate({
                          to: "/adresses",
                          search: {
                            ville: a.ville,
                            ...(a.tranche ? { tranche: a.tranche } : {}),
                            rue: a.rue,
                          },
                        });
                      }
                    },
                    popupopen: () => setSelectedAdresse(a.cle),
                    popupclose: () => setSelectedAdresse((cur) => (cur === a.cle ? null : cur)),
                  }}
                >
                  <Popup>
                    <div className="p-2 font-sans">
                      <p className="mb-1 text-xs font-black text-slate-900">{a.adresse}</p>
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        {a.codePostal ? `${a.codePostal} ` : ""}
                        {a.ville}
                      </p>
                      <p className="mt-1 text-xs font-black text-slate-700">{pluriel(a.lots, "lot")}</p>
                      {a.garages > 0 && (
                        <p className="text-xs font-black text-slate-500">dont {pluriel(a.garages, "garage")}</p>
                      )}
                      {a.tranches.length > 1 && (
                        <div className="mt-1.5 border-t border-slate-200 pt-1.5">
                          <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                            Répartis sur {a.tranches.length} tranches
                          </p>
                          {a.tranches.map((t) => (
                            <button
                              key={t.code}
                              onClick={() =>
                                void navigate({
                                  to: "/adresses",
                                  search: { ville: a.ville, tranche: t.code, rue: a.rue },
                                })
                              }
                              className="block w-full text-left text-[11px] font-semibold text-blue-600 hover:underline"
                            >
                              Tranche {t.code} · {pluriel(t.lots, "lot")}
                              {t.garages > 0 ? ` · ${pluriel(t.garages, "garage")}` : ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })
          ) : (
            villes.map((v) => {
              const total = v.lots + v.garages;
              const t = max > 0 ? total / max : 0;
              return (
                <CircleMarker
                  key={v.ville}
                  center={[v.lat / v.n, v.lng / v.n]}
                  radius={8 + t * 7}
                  pathOptions={{
                    fillColor: colorFor(t),
                    fillOpacity: 0.9,
                    color: "rgba(15, 23, 42, 0.55)",
                    weight: 1.5,
                  }}
                  eventHandlers={{
                    mouseover: (e) => (e.target as L.CircleMarker).openPopup(),
                    mouseout: (e) => (e.target as L.CircleMarker).closePopup(),
                    click: () => {
                      // 2e clic (popup déjà ouverte) → niveau 2 (zoom sur la ville).
                      if (selectedVille === v.ville) setVille(v.ville);
                    },
                    popupopen: () => setSelectedVille(v.ville),
                    popupclose: () => setSelectedVille((cur) => (cur === v.ville ? null : cur)),
                  }}
                >
                  <Popup>
                    <div className="p-2 font-sans">
                      <p className="mb-1 text-[10px] font-black uppercase text-slate-400">{v.ville}</p>
                      <p className="text-xs font-black text-slate-700">{pluriel(v.tranches, "tranche")}</p>
                      <p className="text-xs font-black text-slate-700">{pluriel(v.lots, "lot")}</p>
                      {v.garages > 0 && (
                        <p className="text-xs font-black text-slate-500">dont {pluriel(v.garages, "garage")}</p>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })
          )}
        </MapContainer>

        {villes.length === 0 && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-card/60 text-xs text-muted-foreground">
            {manquantes.length > 0
              ? "Localisation des adresses en cours…"
              : "Aucune adresse localisée pour le moment."}
          </div>
        )}

        {ville && (
          <button
            onClick={() => setVille(null)}
            className="absolute left-3 top-3 z-[1000] flex items-center gap-1 rounded-lg border bg-card px-3 py-2 text-xs font-medium shadow-panel transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-4" /> Toutes les villes
          </button>
        )}

        {/* Légende : peu de lots (jaune) → beaucoup de lots (rouge) */}
        <div className="absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Peu de lots</span>
            <div
              className="h-2 w-32 rounded-full"
              style={{
                background: "linear-gradient(90deg, #facc15 0%, #f97316 50%, #ef4444 100%)",
              }}
            />
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Beaucoup de lots</span>
          </div>
          {!ville && villesNonLocalisees > 0 && (
            <p className="mt-1 text-center text-[8px] font-bold text-amber-600">
              {villesNonLocalisees} ville{villesNonLocalisees > 1 ? "s" : ""} non localisée
              {villesNonLocalisees > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      <p className="border-t p-3 text-xs text-muted-foreground">
        {ville
          ? `${ville} · ${adressesVille.length} adresse${adressesVille.length > 1 ? "s" : ""} localisée${adressesVille.length > 1 ? "s" : ""}`
          : `${villes.length} ville${villes.length > 1 ? "s" : ""} · ${placees} adresse${placees > 1 ? "s" : ""} localisée${placees > 1 ? "s" : ""}`}
        {!ville && villesNonLocalisees > 0 && (
          <span className="text-amber-600">
            {" "}
            · {villesNonLocalisees} ville{villesNonLocalisees > 1 ? "s" : ""} non localisée
            {villesNonLocalisees > 1 ? "s" : ""}
          </span>
        )}
        {!ville && nonGeolocalisees > 0 && (
          <span className="text-amber-600">
            {" "}
            · {nonGeolocalisees} adresse{nonGeolocalisees > 1 ? "s" : ""} non localisée
            {nonGeolocalisees > 1 ? "s" : ""}
          </span>
        )}
        {manquantes.length > 0 && " · localisation des adresses restantes en cours…"}
      </p>
    </div>
  );
}
