import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix pour les icônes Leaflet par défaut
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function DashboardMap({
  dataHeatmap,
  money,
}: {
  dataHeatmap: [string, number][];
  money: (v: number) => string;
}) {
  return (
    <MapContainer
      center={[48.8566, 2.3522]}
      zoom={9}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {dataHeatmap.map(([city, val]) => (
        <Marker
          key={city}
          position={[48.8566 + (Math.random() - 0.5) * 0.1, 2.3522 + (Math.random() - 0.5) * 0.1]}
        >
          <Popup>
            <div className="p-2 font-sans">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{city}</p>
              <p className="text-sm font-black text-blue-600">{money(val)}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
