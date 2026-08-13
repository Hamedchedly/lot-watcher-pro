import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { VilleFournisseur } from "@/lib/fournisseurs.analyse";

/** Montants avec centimes (format fr-FR). */
const moneyCents = (v: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0]!, 12);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [42, 42] });
  }, [map, points]);
  return null;
}

/**
 * Carte des villes d'un fournisseur — inspirée de la carte du Dashboard Travaux
 * (react-leaflet, Popup) mais adaptée à la fiche :
 *  - la TAILLE du cercle est proportionnelle au NOMBRE DE COMMANDES (jamais au montant) ;
 *  - le montant engagé est une information complémentaire du Popup ;
 *  - aucune coordonnée inventée : seules les villes géocodées sont positionnées
 *    (les villes absentes de `villes_geo` sont listées à part par la fiche).
 */
export default function FournisseurVillesMap({ villes }: { villes: VilleFournisseur[] }) {
  const maxCount = useMemo(() => Math.max(0, ...villes.map((d) => d.commandes)), [villes]);
  const points = useMemo(() => villes.map((d) => [d.lat, d.lng] as [number, number]), [villes]);

  return (
    /* `isolate` : la carte crée son propre stacking context — ses panes/popups/légende
       (z-index internes jusqu'à 700/1000) ne peuvent JAMAIS passer au-dessus d'un Dialog
       (z-50) ouvert sur la page. La carte reste entièrement interactive sans dialog. */
    <div className="relative isolate h-full w-full">
      <MapContainer
        center={[48.8566, 2.3522]}
        zoom={9}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={points} />
        {villes.map((d) => {
          const t = maxCount > 0 ? d.commandes / maxCount : 0;
          const radius = 10 + t * 16;
          return (
            <CircleMarker
              key={d.ville}
              center={[d.lat, d.lng]}
              radius={radius}
              pathOptions={{
                fillColor: "#3b82f6",
                fillOpacity: 0.85,
                color: "rgba(15, 23, 42, 0.55)",
                weight: 1.5,
              }}
            >
              <Popup>
                <div className="p-2 font-sans">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{d.ville}</p>
                  <p className="text-xs font-black text-slate-700">
                    {d.commandes} commande{d.commandes > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs font-black text-slate-700">
                    Montant engagé : {moneyCents(d.montant)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Légende : taille = volume de commandes (jamais le montant). */}
      <div className="absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur">
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
          Taille du cercle ∝ nombre de commandes
        </span>
      </div>
    </div>
  );
}
