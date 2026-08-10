import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type VilleAmount = { ville: string; lat: number; lng: number; value: number };

/** Teinte HSL : 60 = jaune (faible investissement), 0 = rouge (fort investissement). */
function colorFor(t: number) {
  const hue = Math.round((1 - Math.min(1, Math.max(0, t))) * 60);
  return `hsl(${hue}, 90%, 50%)`;
}

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

export default function DashboardMap({
  dataVilles,
  money,
  missing = 0,
}: {
  dataVilles: VilleAmount[];
  money: (v: number) => string;
  missing?: number;
}) {
  const max = useMemo(
    () => Math.max(0, ...dataVilles.map((d) => d.value)),
    [dataVilles],
  );
  const points = useMemo(
    () => dataVilles.map((d) => [d.lat, d.lng] as [number, number]),
    [dataVilles],
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[48.8566, 2.3522]}
        zoom={9}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={points} />
        {dataVilles.map((d) => {
          const t = max > 0 ? d.value / max : 0;
          const color = colorFor(t);
          const radius = 8 + t * 7;
          return (
            <CircleMarker
              key={d.ville}
              center={[d.lat, d.lng]}
              radius={radius}
              pathOptions={{
                fillColor: color,
                fillOpacity: 0.9,
                color: "rgba(15, 23, 42, 0.55)",
                weight: 1.5,
              }}
            >
              <Popup>
                <div className="p-2 font-sans">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-1">
                    {d.ville}
                  </p>
                  <p className="text-sm font-black" style={{ color }}>
                    {money(d.value)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Légende : investissement faible (jaune) → élevé (rouge) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] rounded-xl border border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
            Peu investi
          </span>
          <div
            className="h-2 w-32 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, #facc15 0%, #f97316 50%, #ef4444 100%)",
            }}
          />
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
            Très investi
          </span>
        </div>
        {missing > 0 && (
          <p className="mt-1 text-center text-[8px] font-bold text-amber-600">
            {missing} ville{missing > 1 ? "s" : ""} non localisée{missing > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
