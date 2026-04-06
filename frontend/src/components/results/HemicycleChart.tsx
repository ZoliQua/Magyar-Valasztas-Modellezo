import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { PredictedMP } from '../../types/election';

interface HemicycleProps {
  seats: Record<string, number>;
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
  majority: string | null;
  supermajority: boolean;
  mps?: PredictedMP[];
  onShowAllMPs?: () => void;
}

interface SeatDatum {
  party: string;
  color: string;
  x: number;
  y: number;
  mp?: PredictedMP;
}

function generateSeatPositions(totalSeats: number): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
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
      positions.push({ x: -radius * Math.cos(angle), y: -radius * Math.sin(angle) });
    }
  }
  return positions;
}

export default function HemicycleChart({ seats, partyColors, partyNames, majority, supermajority, mps, onShowAllMPs }: HemicycleProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; mp: PredictedMP } | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 600;
    const height = 340;
    const cx = width / 2;
    const cy = height - 20;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const g = svg.append('g').attr('transform', `translate(${cx}, ${cy})`);

    const totalSeats = Object.values(seats).reduce((a, b) => a + b, 0) || 199;
    const positions = generateSeatPositions(totalSeats);

    // Pártok sorrendje: bal → jobb
    const partyOrder: Record<string, number> = {
      dk: 0, mszp: 1, lmp: 2, mkkp: 3, egyseges_ellenzek: 4,
      tisza: 5, mi_hazank: 6, other: 7, jobbik: 8, fidesz_kdnp: 9,
    };
    const sortedParties = Object.entries(seats)
      .filter(([, s]) => s > 0)
      .sort((a, b) => (partyOrder[a[0]] ?? 5) - (partyOrder[b[0]] ?? 5));

    // MP-k párt szerinti csoportosítás
    const mpsByParty: Record<string, PredictedMP[]> = {};
    if (mps) {
      for (const mp of mps) {
        if (!mpsByParty[mp.party_id]) mpsByParty[mp.party_id] = [];
        mpsByParty[mp.party_id].push(mp);
      }
    }

    const seatData: SeatDatum[] = [];
    let seatIndex = 0;
    for (const [party, count] of sortedParties) {
      const partyMPs = mpsByParty[party] || [];
      for (let i = 0; i < count && seatIndex < positions.length; i++) {
        seatData.push({
          party,
          color: partyColors[party] || '#999',
          x: positions[seatIndex].x,
          y: positions[seatIndex].y,
          mp: partyMPs[i],
        });
        seatIndex++;
      }
    }

    // Többségi vonalak
    if (positions[99]) {
      const p = positions[99];
      g.append('line').attr('x1', 0).attr('y1', 0).attr('x2', p.x * 1.15).attr('y2', p.y * 1.15)
        .attr('stroke', '#555').attr('stroke-width', 1).attr('stroke-dasharray', '4,4');
      g.append('text').attr('x', p.x * 1.22).attr('y', p.y * 1.22)
        .attr('fill', '#777').attr('font-size', '10px').attr('text-anchor', 'middle').text('100');
    }
    if (positions[132]) {
      const p = positions[132];
      g.append('line').attr('x1', 0).attr('y1', 0).attr('x2', p.x * 1.15).attr('y2', p.y * 1.15)
        .attr('stroke', '#555').attr('stroke-width', 1).attr('stroke-dasharray', '4,4');
      g.append('text').attr('x', p.x * 1.22).attr('y', p.y * 1.22)
        .attr('fill', '#777').attr('font-size', '10px').attr('text-anchor', 'middle').text('⅔');
    }

    // Székek
    const circles = g.selectAll('circle.seat')
      .data(seatData)
      .enter()
      .append('circle')
      .attr('class', 'seat')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 0)
      .attr('fill', d => d.color)
      .attr('stroke', '#1a1a2e')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer');

    circles.transition().duration(500).delay((_d, i) => i * 3).attr('r', 6);

    // Hover + Click
    circles
      .on('mouseover', function (event, d) {
        d3.select(this).attr('r', 8).attr('stroke', '#fff').attr('stroke-width', 1.5);
        if (d.mp) {
          const rect = svgRef.current!.getBoundingClientRect();
          setTooltip({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top - 50,
            mp: d.mp,
          });
        }
      })
      .on('mouseout', function () {
        d3.select(this).attr('r', 6).attr('stroke', '#1a1a2e').attr('stroke-width', 0.5);
        setTooltip(null);
      });

    // Központi szöveg
    if (majority) {
      const mName = partyNames[majority] || majority;
      const mSeats = seats[majority] || 0;
      g.append('text').attr('x', 0).attr('y', -40).attr('text-anchor', 'middle')
        .attr('fill', partyColors[majority] || '#fff').attr('font-size', '36px')
        .attr('font-weight', 'bold').attr('font-family', 'JetBrains Mono, monospace').text(mSeats);
      g.append('text').attr('x', 0).attr('y', -15).attr('text-anchor', 'middle')
        .attr('fill', '#ccc').attr('font-size', '14px').text(mName);
      if (supermajority) {
        g.append('text').attr('x', 0).attr('y', 5).attr('text-anchor', 'middle')
          .attr('fill', '#fbbf24').attr('font-size', '12px').attr('font-weight', 'bold').text('KÉTHARMAD');
      }
    } else {
      g.append('text').attr('x', 0).attr('y', -25).attr('text-anchor', 'middle')
        .attr('fill', '#999').attr('font-size', '16px').text('Nincs többség');
    }
  }, [seats, partyColors, partyNames, majority, supermajority, mps]);

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400">Parlamenti patkó</h3>
        {onShowAllMPs && (
          <button
            onClick={onShowAllMPs}
            className="px-2.5 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors text-gray-300"
          >
            199 képviselő
          </button>
        )}
      </div>
      <div className="relative">
        <svg ref={svgRef} className="w-full max-w-[600px] mx-auto" preserveAspectRatio="xMidYMid meet" />
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
          </div>
        )}
      </div>
    </div>
  );
}
