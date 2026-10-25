import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { PredictedMP } from '../../types/election';
import { AnimatedNumber, prefersReducedMotion } from '../../hooks/useAnimatedNumber';

interface HemicycleProps {
  seats: Record<string, number>;
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
  majority: string | null;
  supermajority: boolean;
  mps?: PredictedMP[];
  onShowAllMPs?: () => void;
  /** Fejléc (alapértelmezés: "Parlamenti patkó") */
  title?: string;
  /** A későbbi NVB-határozattal belépett képviselők széke gyűrűt kap (tényleges névsor) */
  markChanged?: boolean;
  /** data-chart azonosító (pl. a PDF-export ez alapján különíti el a tényleges patkót) */
  chartId?: string;
  /** Pártra kattintás (jelmagyarázat vagy szék) — pl. a párt képviselőinek listája */
  onPartyClick?: (partyId: string) => void;
}

interface SeatPosition {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

interface SeatDatum extends SeatPosition {
  idx: number;
  party: string;
  color: string;
  mp?: PredictedMP;
}

const WIDTH = 600;
const HEIGHT = 340;
const SEAT_R = 6;

/**
 * Ülőhelyek koncentrikus félkörívekben, SZÖG szerint rendezve (bal → jobb).
 * A szög szerinti sorrend miatt a pártok cikkelyeket alkotnak, és a 100. /
 * 133. ülőhely valóban a többségi határt jelöli.
 */
function generateSeatPositions(totalSeats: number): SeatPosition[] {
  const positions: SeatPosition[] = [];
  const rows = 7;
  const innerRadius = 120;
  const outerRadius = 280;
  const rowGap = (outerRadius - innerRadius) / rows;

  const rowCapacities: number[] = [];
  let totalCapacity = 0;
  for (let r = 0; r < rows; r++) {
    const radius = innerRadius + r * rowGap + rowGap / 2;
    const capacity = radius * Math.PI;
    rowCapacities.push(capacity);
    totalCapacity += capacity;
  }

  const seatsPerRow = rowCapacities.map(c => Math.round((c / totalCapacity) * totalSeats));
  let diff = totalSeats - seatsPerRow.reduce((a, b) => a + b, 0);
  for (let i = seatsPerRow.length - 1; diff !== 0 && i >= 0; i--) {
    if (diff > 0) { seatsPerRow[i]++; diff--; }
    else if (diff < 0 && seatsPerRow[i] > 0) { seatsPerRow[i]--; diff++; }
  }

  for (let r = 0; r < rows; r++) {
    const radius = innerRadius + r * rowGap + rowGap / 2;
    const n = seatsPerRow[r];
    if (n === 0) continue;
    const padding = 0.08;
    for (let i = 0; i < n; i++) {
      const angle = padding + ((Math.PI - 2 * padding) * i) / (n - 1 || 1);
      positions.push({ x: -radius * Math.cos(angle), y: -radius * Math.sin(angle), angle, radius });
    }
  }
  return positions.sort((a, b) => a.angle - b.angle || a.radius - b.radius);
}

// Pártok sorrendje a patkóban: bal → jobb (ismeretlen párt középre kerül)
const PARTY_ORDER: Record<string, number> = {
  dk: 0, mszp: 1, lmp: 2, mkkp: 3, egyseges_ellenzek: 4,
  tisza: 5, mi_hazank: 6, other: 7, jobbik: 8, fidesz_kdnp: 9,
};

export default function HemicycleChart({
  seats, partyColors, partyNames, majority, supermajority, mps, onShowAllMPs, title, markChanged, chartId, onPartyClick,
}: HemicycleProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const centerValueRef = useRef(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; mp: PredictedMP } | null>(null);
  const [hoverParty, setHoverParty] = useState<string | null>(null);
  // A D3-eseménykezelő mindig a legfrissebb callbacket hívja, újrakötés nélkül
  const onPartyClickRef = useRef(onPartyClick);
  onPartyClickRef.current = onPartyClick;

  const totalSeats = Object.values(seats).reduce((a, b) => a + b, 0) || 199;
  const positions = useMemo(() => generateSeatPositions(totalSeats), [totalSeats]);

  const sortedParties = useMemo(() => Object.entries(seats)
    .filter(([, s]) => s > 0)
    .sort((a, b) => (PARTY_ORDER[a[0]] ?? 5) - (PARTY_ORDER[b[0]] ?? 5)), [seats]);

  const seatData = useMemo(() => {
    const mpsByParty: Record<string, PredictedMP[]> = {};
    for (const mp of mps || []) {
      (mpsByParty[mp.party_id] ||= []).push(mp);
    }
    const data: SeatDatum[] = [];
    for (const [party, count] of sortedParties) {
      const partyMPs = mpsByParty[party] || [];
      for (let i = 0; i < count && data.length < positions.length; i++) {
        const idx = data.length;
        data.push({ ...positions[idx], idx, party, color: partyColors[party] || '#999', mp: partyMPs[i] });
      }
    }
    return data;
  }, [sortedParties, positions, partyColors, mps]);

  const changedCount = markChanged ? seatData.filter(d => d.mp?.granted_by).length : 0;

  // Vázszerkezet: rétegek és többségi vonalak — csak a székszám változásakor épül újra
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
    const g = svg.append('g').attr('class', 'root').attr('transform', `translate(${WIDTH / 2}, ${HEIGHT - 20})`);

    const lines = g.append('g').attr('class', 'lines');
    const thresholds: Array<[number, string]> = [[100, '100'], [133, '⅔']];
    for (const [seatNo, label] of thresholds) {
      const p = positions[seatNo - 1];
      if (!p) continue;
      // A határ a két szomszédos ülés szöge között fut
      const next = positions[seatNo] || p;
      const angle = (p.angle + next.angle) / 2;
      const ux = -Math.cos(angle), uy = -Math.sin(angle);
      lines.append('line')
        .attr('x1', ux * 100).attr('y1', uy * 100).attr('x2', ux * 300).attr('y2', uy * 300)
        .attr('stroke', '#555').attr('stroke-width', 1).attr('stroke-dasharray', '4,4');
      lines.append('text').attr('x', ux * 314).attr('y', uy * 314 + 3)
        .attr('fill', '#777').attr('font-size', '10px').attr('text-anchor', 'middle').text(label);
    }

    g.append('g').attr('class', 'seats');
    const center = g.append('g').attr('class', 'center');
    center.append('text').attr('class', 'center-value').attr('y', -40).attr('text-anchor', 'middle')
      .attr('font-size', '36px').attr('font-weight', 'bold').attr('font-family', 'JetBrains Mono, monospace');
    center.append('text').attr('class', 'center-label').attr('y', -15).attr('text-anchor', 'middle')
      .attr('fill', '#ccc').attr('font-size', '14px');
    center.append('text').attr('class', 'center-note').attr('y', 5).attr('text-anchor', 'middle')
      .attr('fill', '#fbbf24').attr('font-size', '12px').attr('font-weight', 'bold');
    centerValueRef.current = 0;
  }, [positions]);

  // Székek: kulcsolt adatkötés — változáskor a meglévő székek átszíneződnek
  // (balról jobbra futó hullámban), nem rajzolódik újra az egész ábra.
  useEffect(() => {
    if (!svgRef.current) return;
    const root = d3.select(svgRef.current).select<SVGGElement>('g.root');
    const reduce = prefersReducedMotion();
    const duration = reduce ? 0 : 650;

    const baseStroke = (d: SeatDatum) => (markChanged && d.mp?.granted_by ? '#ffffff' : '#1a1a2e');
    const baseStrokeWidth = (d: SeatDatum) => (markChanged && d.mp?.granted_by ? 1.6 : 0.5);

    const circles = root.select('g.seats')
      .selectAll<SVGCircleElement, SeatDatum>('circle.seat')
      .data(seatData, d => String(d.idx));

    circles.exit().transition().duration(duration).attr('r', 0).remove();

    const entered = circles.enter().append('circle')
      .attr('class', 'seat')
      .attr('cx', d => d.x).attr('cy', d => d.y)
      .attr('r', 0)
      .attr('fill', d => d.color);
    entered.transition().duration(reduce ? 0 : 500).delay(d => (reduce ? 0 : d.idx * 3)).attr('r', SEAT_R);

    circles.transition().duration(duration).delay(d => (reduce ? 0 : d.idx * 2))
      .attr('r', SEAT_R)
      .attr('fill', d => d.color);

    entered.merge(circles)
      .attr('stroke', baseStroke)
      .attr('stroke-width', baseStrokeWidth)
      .style('cursor', onPartyClick ? 'pointer' : 'default')
      .on('click', (_event, d) => onPartyClickRef.current?.(d.party))
      .on('mouseover', function (event, d) {
        d3.select(this).attr('r', SEAT_R + 2).attr('stroke', '#fff').attr('stroke-width', 1.5);
        setHoverParty(d.party);
        if (d.mp) {
          const rect = svgRef.current!.getBoundingClientRect();
          setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top - 56, mp: d.mp });
        }
      })
      .on('mouseout', function (_event, d) {
        d3.select(this).attr('r', SEAT_R).attr('stroke', baseStroke(d)).attr('stroke-width', baseStrokeWidth(d));
        setHoverParty(null);
        setTooltip(null);
      });

    // Középső felirat: a többségi párt mandátumszáma "felszámol" az új értékre
    const center = root.select('g.center');
    const target = majority ? seats[majority] || 0 : 0;
    const from = centerValueRef.current;
    centerValueRef.current = target;
    center.select<SVGTextElement>('text.center-value')
      .attr('fill', majority ? partyColors[majority] || '#fff' : '#999')
      .transition().duration(duration)
      .tween('text', function () {
        const interp = d3.interpolateRound(from, target);
        return t => { this.textContent = majority ? String(interp(t)) : ''; };
      });
    center.select('text.center-label')
      .attr('fill', majority ? '#ccc' : '#999')
      .attr('font-size', majority ? '14px' : '16px')
      .text(majority ? partyNames[majority] || majority : 'Nincs többség');
    center.select('text.center-note').text(supermajority ? 'KÉTHARMAD' : '');
  }, [seatData, seats, partyColors, partyNames, majority, supermajority, markChanged, !!onPartyClick]);

  // Pártkiemelés: a többi párt székei elhalványulnak
  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).selectAll<SVGCircleElement, SeatDatum>('circle.seat')
      .transition('highlight').duration(prefersReducedMotion() ? 0 : 200)
      .attr('opacity', d => (hoverParty && d.party !== hoverParty ? 0.18 : 1));
  }, [hoverParty, seatData]);

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400">{title || 'Parlamenti patkó'}</h3>
        {onShowAllMPs && (
          <button
            onClick={onShowAllMPs}
            className="px-2.5 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors text-gray-300"
          >
            {totalSeats} képviselő
          </button>
        )}
      </div>
      <div className="relative">
        <svg ref={svgRef} data-chart={chartId} className="w-full max-w-[600px] mx-auto" preserveAspectRatio="xMidYMid meet"
          role="img" aria-label={`Parlamenti patkó: ${sortedParties.map(([p, n]) => `${partyNames[p] || p} ${n}`).join(', ')}`} />
        {tooltip && (
          <div
            className="absolute z-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl px-3 py-2 pointer-events-none text-xs"
            style={{ left: tooltip.x, top: tooltip.y, transform: 'translateX(-50%)' }}
          >
            <div className="text-white font-medium">{tooltip.mp.name}</div>
            <div className="text-gray-400">
              {partyNames[tooltip.mp.party_id] || tooltip.mp.party_id}
              {' — '}
              {tooltip.mp.source === 'oevk'
                ? <span className="text-blue-400">{tooltip.mp.oevk_name}</span>
                : <span className="text-purple-400">Lista #{tooltip.mp.list_position}{tooltip.mp.original_list_position ? ` (ered. #${tooltip.mp.original_list_position})` : ''}</span>
              }
            </div>
            {tooltip.mp.granted_by_ref && (
              <div className="text-amber-300 mt-0.5">Később lépett be ({tooltip.mp.granted_by_ref})</div>
            )}
          </div>
        )}
      </div>

      {/* Jelmagyarázat — rámutatva kiemeli a párt székeit */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
        {sortedParties.map(([party, count]) => (
          <button
            key={party}
            type="button"
            onMouseEnter={() => setHoverParty(party)}
            onMouseLeave={() => setHoverParty(null)}
            onFocus={() => setHoverParty(party)}
            onBlur={() => setHoverParty(null)}
            onClick={onPartyClick ? () => onPartyClick(party) : undefined}
            title={onPartyClick ? `${partyNames[party] || party} — képviselők listája` : undefined}
            className={`flex items-center gap-1.5 text-xs rounded px-1.5 py-0.5 transition-opacity ${
              onPartyClick ? 'cursor-pointer hover:bg-gray-800' : 'cursor-default'
            } ${
              hoverParty && hoverParty !== party ? 'opacity-40' : 'opacity-100'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: partyColors[party] || '#999' }} />
            <span className="text-gray-300">{partyNames[party] || party}</span>
            <span className="font-data text-white"><AnimatedNumber value={count} /></span>
          </button>
        ))}
        {changedCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400 px-1.5 py-0.5">
            <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-white" />
            később belépett ({changedCount})
          </span>
        )}
      </div>
    </div>
  );
}
