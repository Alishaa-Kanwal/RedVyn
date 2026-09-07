"use client";

import { useMemo } from "react";
import { Loader2, MapPin, Hospital } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function projectToSvg(points, viewBox) {
  if (!points || points.length === 0) return [];
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const latPad = (maxLat - minLat || 0.01) * 0.15;
  const lonPad = (maxLon - minLon || 0.01) * 0.15;
  const bounds = {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad,
  };

  return points.map((p) => ({
    ...p,
    x: ((p.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * viewBox.width,
    y: viewBox.height - ((p.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * viewBox.height,
  }));
}

/**
 * Place donors around the central hospital for the emergency radar view.
 * Distance is read from the donor object when available; otherwise dots fall
 * on the outer ring.
 */
function projectToRadar(donors, effectiveRadius) {
  const maxRadius = 95;
  const radius = effectiveRadius && effectiveRadius > 0 ? effectiveRadius : 1;

  return (donors || []).map((d, i) => {
    const distance = d.distance || radius;
    const ratio = Math.min(distance / radius, 1);
    const angle = ((i * 137.5) * Math.PI) / 180;
    const r = ratio * maxRadius;
    return {
      ...d,
      cx: 110 + r * Math.cos(angle),
      cy: 110 + r * Math.sin(angle),
    };
  });
}

const MAP_VIEWBOX = { width: 320, height: 180 };

function MapView({ hospitals, donors, activeCase }) {
  const projected = useMemo(() => {
    const hospitalPins = (hospitals || []).map((h) => ({ ...h, type: "hospital" }));
    const donorPins = (donors || []).map((d) => ({ ...d, type: "donor" }));
    return projectToSvg([...hospitalPins, ...donorPins], MAP_VIEWBOX);
  }, [hospitals, donors]);

  const activePin = useMemo(() => {
    if (!activeCase) return null;
    const target = projected.find((p) => p.type === "hospital" && p.id === activeCase.hospitalId);
    return target || projected.find((p) => p.type === "hospital");
  }, [activeCase, projected]);

  return (
    <div className="relative h-64 w-full sm:h-72">
      <svg
        viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        {/* Map surface */}
        <rect width={MAP_VIEWBOX.width} height={MAP_VIEWBOX.height} className="fill-muted/40 dark:fill-muted/20" />

        {/* Water / park blocks */}
        <path
          d="M0 120 Q 60 100 120 130 T 240 110 L 320 140 V 180 H 0 Z"
          className="fill-blue-100/60 stroke-blue-200 dark:fill-blue-950/30 dark:stroke-blue-900/40"
          strokeWidth="1"
        />
        <path
          d="M180 0 Q 220 40 200 90 T 260 140 L 320 120 V 0 H 180 Z"
          className="fill-emerald-100/40 stroke-emerald-200 dark:fill-emerald-950/20 dark:stroke-emerald-900/30"
          strokeWidth="1"
        />

        {/* Roads */}
        <g className="stroke-border/80 dark:stroke-border/60" strokeWidth="2" fill="none">
          <path d="M0 60 H 320" />
          <path d="M0 150 H 320" />
          <path d="M80 0 V 180" />
          <path d="M240 0 V 180" />
          <path d="M0 0 L 320 180" />
        </g>

        {/* Pulse rings around active case */}
        {activePin && (
          <g transform={`translate(${activePin.x}, ${activePin.y})`}>
            <circle r="8" className="fill-primary" />
            <circle r="8" className="fill-none stroke-primary stroke-2">
              <animate attributeName="r" from="8" to="48" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.8" to="0" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r="8" className="fill-none stroke-primary stroke-1">
              <animate attributeName="r" from="8" to="36" dur="2s" begin="0.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.6" to="0" dur="2s" begin="0.6s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {/* Donor pins */}
        {projected
          .filter((p) => p.type === "donor")
          .map((pin, i) => (
            <circle
              key={`donor-${i}`}
              cx={pin.x}
              cy={pin.y}
              r="4"
              className="fill-primary stroke-2 stroke-card"
            />
          ))}

        {/* Hospital pins */}
        {projected
          .filter((p) => p.type === "hospital")
          .map((pin, i) => (
            <g key={`hospital-${i}`} transform={`translate(${pin.x}, ${pin.y})`}>
              <circle r="10" className="fill-card stroke-primary stroke-2" />
              <foreignObject x="-6" y="-6" width="12" height="12">
                <div className="flex h-full w-full items-center justify-center text-primary">
                  <MapPin className="h-2.5 w-2.5" />
                </div>
              </foreignObject>
            </g>
          ))}
      </svg>

      {!activePin && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/60 backdrop-blur-[2px]">
          <p className="text-sm text-muted-foreground">No active case to display.</p>
        </div>
      )}
    </div>
  );
}

function RadarView({ hospitals, donors, activeCase }) {
  const radiusMeters = activeCase?.radiusMeters;
  const hospitalExists =
    activeCase?.hospitalId && hospitals?.some((h) => h.id === activeCase.hospitalId);

  const maxDonorDistance = useMemo(
    () => Math.max(...(donors || []).map((d) => d.distance || 0).filter(Boolean), 0),
    [donors],
  );

  const effectiveRadius =
    radiusMeters && radiusMeters > 0 ? radiusMeters : maxDonorDistance > 0 ? maxDonorDistance : null;

  const projected = useMemo(
    () => projectToRadar(donors, effectiveRadius),
    [donors, effectiveRadius],
  );

  const radiusKm = useMemo(() => {
    if (effectiveRadius && effectiveRadius > 0) return Math.round(effectiveRadius / 1000);
    return null;
  }, [effectiveRadius]);

  const rings = [23.75, 47.5, 71.25, 95];

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative aspect-square w-full max-w-[280px]">
        <svg viewBox="0 0 220 220" className="h-full w-full">
          {/* Radar surface */}
          <circle cx="110" cy="110" r="110" className="fill-muted/20 dark:fill-muted/10" />

          {/* Concentric rings */}
          {rings.map((r, i) => (
            <circle
              key={r}
              cx="110"
              cy="110"
              r={r}
              className="fill-none stroke-primary/15 dark:stroke-primary/20"
              strokeWidth="1"
            >
              {i === rings.length - 1 && (
                <animate
                  attributeName="opacity"
                  values="0.6;0.2;0.6"
                  dur="3s"
                  repeatCount="indefinite"
                />
              )}
            </circle>
          ))}

          {/* Donor dots */}
          {projected.map((pin, i) => (
            <circle
              key={`radar-donor-${i}`}
              cx={pin.cx}
              cy={pin.cy}
              r="5"
              className="fill-primary stroke-2 stroke-card"
            />
          ))}

          {/* Central hospital pin with pulse */}
          <g transform="translate(110, 110)">
            <circle r="24" className="fill-primary" />
            <circle r="24" className="fill-none stroke-primary stroke-2">
              <animate attributeName="r" from="24" to="56" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.8" to="0" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r="24" className="fill-none stroke-primary stroke-1">
              <animate attributeName="r" from="24" to="44" dur="2s" begin="0.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.5" to="0" dur="2s" begin="0.6s" repeatCount="indefinite" />
            </circle>
            <foreignObject x="-12" y="-12" width="24" height="24">
              <div className="flex h-full w-full items-center justify-center text-primary-foreground">
                <Hospital className="h-5 w-5" />
              </div>
            </foreignObject>
          </g>
        </svg>

        {!hospitalExists && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-card/60 backdrop-blur-[2px]">
            <p className="text-sm text-muted-foreground">No hospital selected.</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm font-semibold text-foreground">
        {radiusKm != null ? `Radius: ${radiusKm} KM` : "Radius: —"}
      </p>
    </div>
  );
}

export function LiveMapPanel({
  hospitals,
  donors,
  activeCase,
  loading,
  error,
  mode = "map",
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm text-destructive">Unable to load map data.</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {mode === "radar" ? (
        <RadarView hospitals={hospitals} donors={donors} activeCase={activeCase} />
      ) : (
        <MapView hospitals={hospitals} donors={donors} activeCase={activeCase} />
      )}
    </div>
  );
}
