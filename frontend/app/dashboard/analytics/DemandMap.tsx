"use client";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Zone {
  name: string;
  score: number;
  lat: number | null;
  lng: number | null;
}

function scoreColor(score: number) {
  if (score >= 67) return "#22c55e";
  if (score >= 34) return "#f59e0b";
  return "#ef4444";
}

export default function DemandMap({ zones }: { zones: Zone[] }) {
  const mapped = zones.filter((z) => z.lat != null && z.lng != null);
  if (!mapped.length) return null;

  const center: [number, number] = [
    mapped.reduce((s, z) => s + z.lat!, 0) / mapped.length,
    mapped.reduce((s, z) => s + z.lng!, 0) / mapped.length,
  ];

  return (
    <MapContainer
      center={center}
      zoom={mapped.length === 1 ? 10 : 7}
      style={{ height: 280, width: "100%", borderRadius: "0.75rem", zIndex: 0 }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
      />
      {mapped.map((z) => (
        <CircleMarker
          key={z.name}
          center={[z.lat!, z.lng!]}
          radius={10 + (z.score / 100) * 20}
          fillColor={scoreColor(z.score)}
          color={scoreColor(z.score)}
          fillOpacity={0.55}
          weight={2}
        >
          <Tooltip>
            <span className="text-xs font-semibold">{z.name}</span>
            <br />
            <span className="text-xs">Indice : {z.score}/100</span>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
