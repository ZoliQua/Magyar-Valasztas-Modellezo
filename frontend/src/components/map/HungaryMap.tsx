import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { OevkSimResult } from '../../types/election';

interface HungaryMapProps {
  oevkResults: OevkSimResult[];
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
  onOevkClick?: (oevkId: string, displayName: string, county: string) => void;
}

interface GeoFeature {
  type: 'Feature';
  properties: {
    oevk_id: string;
    county: string;
    oevk_number: number;
    display_name: string;
  };
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}

interface GeoCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

// Magyarország határai (lng, lat)
const HU_BOUNDS = { minLng: 16.1, maxLng: 22.9, minLat: 45.7, maxLat: 48.6 };

// Budapest közelítés (lng, lat)
const BUDAPEST_VIEW = { minLng: 18.85, maxLng: 19.25, minLat: 47.35, maxLat: 47.62 };

const SVG_W = 800;
const SVG_H = 450;
const PAD = 20;

interface ViewBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

function lngLatToSvg(lng: number, lat: number, vb: ViewBox): [number, number] {
  const x = PAD + ((lng - vb.minLng) / (vb.maxLng - vb.minLng)) * (SVG_W - 2 * PAD);
  const y = PAD + ((vb.maxLat - lat) / (vb.maxLat - vb.minLat)) * (SVG_H - 2 * PAD);
  return [x, y];
}

function ringToPath(ring: number[][], vb: ViewBox): string {
  const pts = ring.map(([lng, lat]) => lngLatToSvg(lng, lat, vb));
  if (pts.length === 0) return '';
  return 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') + ' Z';
}

function getColorWithAlpha(color: string, margin: number): string {
  const a = margin < 5 ? 0.45 : margin < 15 ? 0.7 : 1.0;
  return color + Math.round(a * 255).toString(16).padStart(2, '0');
}

export default function HungaryMap({ oevkResults, partyColors, partyNames, onOevkClick }: HungaryMapProps) {
  const [geojson, setGeojson] = useState<GeoCollection | null>(null);
  const [hoveredOevk, setHoveredOevk] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [view, setView] = useState<ViewBox>(HU_BOUNDS);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    import('../../data/hungary-oevk.json')
      .then(mod => setGeojson(mod.default as unknown as GeoCollection))
      .catch(() => {});
  }, []);

  const resultMap = useMemo(() => {
    const m = new Map<string, OevkSimResult>();
    for (const r of oevkResults) m.set(r.oevk_id, r);
    return m;
  }, [oevkResults]);

  const featurePaths = useMemo(() => {
    if (!geojson) return [];
    return geojson.features.map(feature => {
      const pathD = feature.geometry.coordinates.map(ring => ringToPath(ring, view)).join(' ');
      return { feature, pathD };
    });
  }, [geojson, view]);

  const hoveredData = useMemo(() => {
    if (!hoveredOevk) return null;
    const result = resultMap.get(hoveredOevk);
    const fp = featurePaths.find(fp => fp.feature.properties.oevk_id === hoveredOevk);
    if (!result || !fp) return null;
    return { result, feature: fp.feature };
  }, [hoveredOevk, resultMap, featurePaths]);

  // Zoom görgővel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Egérpozíció → geo koordináta
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const centerLng = view.minLng + mx * (view.maxLng - view.minLng);
    const centerLat = view.maxLat - my * (view.maxLat - view.minLat);

    const newW = (view.maxLng - view.minLng) * factor;
    const newH = (view.maxLat - view.minLat) * factor;

    // Limit zoom
    if (newW > 10 || newW < 0.1) return;

    setView({
      minLng: centerLng - newW * mx,
      maxLng: centerLng + newW * (1 - mx),
      minLat: centerLat - newH * (1 - my),
      maxLat: centerLat + newH * my,
    });
  }, [view]);

  // Pan egérrel
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMoveMap = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltipPos({ x: e.clientX - rect.left + 15, y: e.clientY - rect.top - 10 });

    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    const lngPerPx = (view.maxLng - view.minLng) / rect.width;
    const latPerPx = (view.maxLat - view.minLat) / rect.height;

    setView(v => ({
      minLng: v.minLng - dx * lngPerPx,
      maxLng: v.maxLng - dx * lngPerPx,
      minLat: v.minLat + dy * latPerPx,
      maxLat: v.maxLat + dy * latPerPx,
    }));
  }, [view]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Preset nézetek
  const zoomTo = useCallback((target: ViewBox) => setView(target), []);

  if (!geojson) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-center text-gray-500 py-12">
        Térkép betöltése...
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400">Magyarország — 106 OEVK</h3>
        <div className="flex gap-1.5">
          <button
            onClick={() => zoomTo(BUDAPEST_VIEW)}
            className="px-2.5 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors text-gray-300"
          >
            Budapest
          </button>
          <button
            onClick={() => zoomTo({ minLng: 18.6, maxLng: 19.8, minLat: 47.1, maxLat: 47.9 })}
            className="px-2.5 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors text-gray-300"
          >
            Közép-Mo.
          </button>
          <button
            onClick={() => zoomTo(HU_BOUNDS)}
            className="px-2.5 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors text-gray-300"
          >
            Ország
          </button>
          <button
            onClick={() => {
              const w = (view.maxLng - view.minLng) * 0.75;
              const h = (view.maxLat - view.minLat) * 0.75;
              const cLng = (view.minLng + view.maxLng) / 2;
              const cLat = (view.minLat + view.maxLat) / 2;
              setView({ minLng: cLng - w / 2, maxLng: cLng + w / 2, minLat: cLat - h / 2, maxLat: cLat + h / 2 });
            }}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors text-gray-300"
          >
            +
          </button>
          <button
            onClick={() => {
              const w = (view.maxLng - view.minLng) * 1.33;
              const h = (view.maxLat - view.minLat) * 1.33;
              const cLng = (view.minLng + view.maxLng) / 2;
              const cLat = (view.minLat + view.maxLat) / 2;
              setView({ minLng: cLng - w / 2, maxLng: cLng + w / 2, minLat: cLat - h / 2, maxLat: cLat + h / 2 });
            }}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors text-gray-300"
          >
            −
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveMap}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { isDragging.current = false; setHoveredOevk(null); }}
        style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
      >
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full max-w-[800px] mx-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="#111827" rx="8" />

          {featurePaths.map(({ feature, pathD }) => {
            const oevkId = feature.properties.oevk_id;
            const result = resultMap.get(oevkId);
            const winnerColor = result ? (partyColors[result.winner_party] || '#555') : '#333';
            const fillColor = result ? getColorWithAlpha(winnerColor, result.margin) : '#2a2a3e';
            const isHovered = hoveredOevk === oevkId;

            return (
              <path
                key={oevkId}
                d={pathD}
                fill={fillColor}
                stroke={isHovered ? '#fff' : '#1f2937'}
                strokeWidth={isHovered ? 2 : 0.5}
                className="cursor-pointer"
                opacity={hoveredOevk && !isHovered ? 0.5 : 1}
                onMouseEnter={() => { if (!isDragging.current) setHoveredOevk(oevkId); }}
                onMouseLeave={() => setHoveredOevk(null)}
                onClick={(e) => {
                  if (!isDragging.current) {
                    e.stopPropagation();
                    onOevkClick?.(oevkId, feature.properties.display_name, feature.properties.county);
                  }
                }}
              />
            );
          })}
        </svg>

        {hoveredData && !isDragging.current && (
          <div
            className="absolute z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 pointer-events-none min-w-[200px]"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <div className="font-medium text-white text-sm mb-1">
              {hoveredData.feature.properties.display_name}
            </div>
            <div className="text-xs text-gray-400 mb-2">{hoveredData.feature.properties.county}</div>
            <div className="space-y-1">
              {hoveredData.result.results.slice(0, 4).map(r => (
                <div key={r.party_id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: partyColors[r.party_id] || '#999' }} />
                    <span className="text-xs text-gray-300">{partyNames[r.party_id] || r.party_id}</span>
                  </div>
                  <span className="font-data text-xs text-white">{r.vote_share_pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <div className="mt-1 pt-1 border-t border-gray-700 text-xs text-gray-500">
              Margin: {hoveredData.result.margin.toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3 justify-center">
        {Object.entries(partyColors)
          .filter(([id]) => oevkResults.some(r => r.winner_party === id))
          .map(([id, color]) => (
            <div key={id} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-400">{partyNames[id] || id}</span>
            </div>
          ))}
        <span className="text-xs text-gray-600 ml-2">Görgő: zoom | Húzás: mozgatás</span>
      </div>
    </div>
  );
}
