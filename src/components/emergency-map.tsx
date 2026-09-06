import { useMemo } from "react";

import { NODE_COORDS, boundsOf, project, type LatLng } from "@/lib/geo";
import { roadStateLabel, severityLabel, type Severity } from "@/lib/emergency";
import type { Hospital, Incident, Road, Shelter, Vehicle } from "@/lib/queries";
import { cn } from "@/lib/utils";

export type MapLayers = {
  incidents: boolean;
  vehicles: boolean;
  hospitals: boolean;
  shelters: boolean;
  roads: boolean;
};

export const defaultLayers: MapLayers = {
  incidents: true,
  vehicles: true,
  hospitals: true,
  shelters: true,
  roads: true,
};

const severityStroke: Record<Severity, string> = {
  critical: "var(--critical)",
  high: "var(--high)",
  moderate: "var(--moderate)",
  safe: "var(--safe)",
};

export function EmergencyMap({
  incidents,
  vehicles,
  hospitals,
  shelters,
  roads,
  layers = defaultLayers,
  highlightPath,
  className,
}: {
  incidents: Incident[];
  vehicles: Vehicle[];
  hospitals: Hospital[];
  shelters: Shelter[];
  roads: Road[];
  layers?: MapLayers;
  /** Node names of a planned route, drawn as a thick blue corridor. */
  highlightPath?: string[];
  className?: string;
}) {
  const bounds = useMemo(() => {
    const points: LatLng[] = [
      ...Object.values(NODE_COORDS).filter((c) => c.lat > 27 && c.lng < 86),
      ...hospitals.map((h) => ({ lat: h.lat, lng: h.lng })),
      ...shelters.map((s) => ({ lat: s.lat, lng: s.lng })),
      ...incidents.map((i) => ({ lat: i.lat, lng: i.lng })),
    ];
    return boundsOf(points);
  }, [hospitals, shelters, incidents]);

  const p = (point: LatLng) => project(point, bounds);
  const nodeAt = (name: string) => NODE_COORDS[name];

  const roadLines = roads
    .map((road) => {
      const a = nodeAt(road.from_node);
      const b = nodeAt(road.to_node);
      if (!a || !b) return null;
      return { road, a: p(a), b: p(b) };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const pathNodes = highlightPath ?? [];
  const highlightSegments = pathNodes
    .slice(0, -1)
    .map((from, index) => {
      const to = pathNodes[index + 1] ?? "";
      const a = nodeAt(from);
      const b = nodeAt(to);
      if (!a || !b) return null;
      return { key: `${from}-${to}`, a: p(a), b: p(b) };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return (
    <div className={cn("panel overflow-hidden", className)}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label="Schematic map of the emergency operating area showing roads, incidents, vehicles, hospitals and shelters. A text list of the same information follows below the map."
        className="h-[22rem] w-full bg-secondary/50 sm:h-[28rem]"
      >
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="currentColor" strokeWidth="0.15" opacity="0.18" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" className="text-muted-foreground" />

        {layers.roads &&
          roadLines.map(({ road, a, b }) => (
            <g key={road.id}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={severityStroke[road.risk]}
                strokeWidth={road.state === "open" ? 0.8 : 1.2}
                strokeDasharray={road.state === "open" ? undefined : "2 1.6"}
                strokeLinecap="round"
                opacity={0.85}
              />
            </g>
          ))}

        {highlightSegments.map(({ key, a, b }) => (
          <line
            key={key}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--primary)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity={0.9}
          />
        ))}

        {Object.entries(NODE_COORDS).map(([name, coord]) => {
          const pos = p(coord);
          if (pos.x < -5 || pos.x > 105 || pos.y < -5 || pos.y > 105) return null;
          return (
            <g key={name}>
              <circle cx={pos.x} cy={pos.y} r="0.8" fill="currentColor" className="text-foreground" />
              <text
                x={pos.x + 1.4}
                y={pos.y + 0.6}
                fontSize="2.1"
                fill="currentColor"
                className="text-muted-foreground"
              >
                {name}
              </text>
            </g>
          );
        })}

        {layers.hospitals &&
          hospitals.map((h) => {
            const pos = p(h);
            return (
              <g key={h.id}>
                <rect
                  x={pos.x - 1.1}
                  y={pos.y - 1.1}
                  width="2.2"
                  height="2.2"
                  rx="0.5"
                  fill="var(--safe)"
                />
                <path
                  d={`M${pos.x - 0.6} ${pos.y}H${pos.x + 0.6}M${pos.x} ${pos.y - 0.6}V${pos.y + 0.6}`}
                  stroke="white"
                  strokeWidth="0.3"
                />
              </g>
            );
          })}

        {layers.shelters &&
          shelters.map((s) => {
            const pos = p(s);
            return (
              <polygon
                key={s.id}
                points={`${pos.x},${pos.y - 1.3} ${pos.x + 1.2},${pos.y + 1} ${pos.x - 1.2},${pos.y + 1}`}
                fill="var(--moderate)"
              />
            );
          })}

        {layers.vehicles &&
          vehicles.map((v) => {
            const pos = p(v);
            return (
              <g key={v.id}>
                <circle cx={pos.x} cy={pos.y} r="1.1" fill="var(--primary)" />
                <circle cx={pos.x} cy={pos.y} r="1.9" fill="none" stroke="var(--primary)" strokeWidth="0.2" />
              </g>
            );
          })}

        {layers.incidents &&
          incidents.map((i) => {
            const pos = p(i);
            return (
              <g key={i.id}>
                <circle cx={pos.x} cy={pos.y} r="2.4" fill={severityStroke[i.severity]} opacity="0.22" />
                <circle cx={pos.x} cy={pos.y} r="1.2" fill={severityStroke[i.severity]} />
              </g>
            );
          })}
      </svg>

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <LegendItem color="var(--critical)" label="Emergency incident" />
        <LegendItem color="var(--primary)" label="Emergency vehicle" />
        <LegendItem color="var(--safe)" label="Hospital" shape="square" />
        <LegendItem color="var(--moderate)" label="Shelter / rescue centre" shape="triangle" />
        <LegendItem color="var(--safe)" label="Safe road" shape="line" />
        <LegendItem color="var(--critical)" label="Blocked / damaged road" shape="dashed" />
        <LegendItem color="var(--primary)" label="Planned route" shape="line" />
      </div>

      {/* Screen-reader and keyboard equivalent of the map. */}
      <details className="border-t border-border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Map contents as text ({incidents.length} incidents, {vehicles.length} vehicles,{" "}
          {roads.length} road segments)
        </summary>
        <div className="mt-3 space-y-3">
          <MapList
            title="Incidents"
            items={incidents.map(
              (i) =>
                `${i.incident_type} at ${i.location_name} — ${severityLabel[i.severity]} severity, ${i.people_affected} people affected`,
            )}
          />
          <MapList
            title="Roads"
            items={roads.map(
              (r) =>
                `${r.road_name}: ${r.from_node} to ${r.to_node}, ${roadStateLabel[r.state]}, risk ${severityLabel[r.risk]}`,
            )}
          />
          <MapList
            title="Vehicles"
            items={vehicles.map((v) => `${v.code} (${v.kind}) — ${v.status.replace("_", " ")}`)}
          />
          <MapList
            title="Hospitals"
            items={hospitals.map((h) => `${h.name}, ${h.district} — ${h.beds_available} beds free`)}
          />
          <MapList
            title="Shelters"
            items={shelters.map((s) => `${s.name}, ${s.district} — ${s.occupancy}/${s.capacity} occupied`)}
          />
        </div>
      </details>
    </div>
  );
}

function MapList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="label-caps">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function LegendItem({
  color,
  label,
  shape = "dot",
}: {
  color: string;
  label: string;
  shape?: "dot" | "square" | "triangle" | "line" | "dashed";
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="inline-flex w-4 justify-center">
        {shape === "line" || shape === "dashed" ? (
          <span
            className="h-0.5 w-4"
            style={
              shape === "dashed"
                ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)` }
                : { backgroundColor: color }
            }
          />
        ) : (
          <span
            className={cn("size-2.5", shape === "square" ? "rounded-[2px]" : "rounded-full")}
            style={
              shape === "triangle"
                ? { width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: `9px solid ${color}` }
                : { backgroundColor: color }
            }
          />
        )}
      </span>
      {label}
    </span>
  );
}
