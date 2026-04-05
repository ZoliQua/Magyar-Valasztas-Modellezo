import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface HemicycleProps {
  seats: Record<string, number>;
  partyColors: Record<string, string>;
  partyNames: Record<string, string>;
  majority: string | null;
  supermajority: boolean;
}

interface SeatData {
  party: string;
  color: string;
  x: number;
  y: number;
}

function generateSeatPositions(totalSeats: number): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];

  // 7 sor koncentrikus ívben
  const rows = 7;
  const innerRadius = 120;
  const outerRadius = 280;
  const rowGap = (outerRadius - innerRadius) / rows;

  // Székelosztás a soronkénti ívhossz arányában
  const rowCapacities: number[] = [];
  let totalCapacity = 0;
  for (let r = 0; r < rows; r++) {
    const radius = innerRadius + r * rowGap + rowGap / 2;
    const capacity = radius * Math.PI; // félkör kerülete arányosan
    rowCapacities.push(capacity);
    totalCapacity += capacity;
  }

  const seatsPerRow = rowCapacities.map(c =>
    Math.round((c / totalCapacity) * totalSeats)
  );

  // Korrekció, hogy összesen pontosan totalSeats legyen
  let diff = totalSeats - seatsPerRow.reduce((a, b) => a + b, 0);
  for (let i = seatsPerRow.length - 1; diff !== 0 && i >= 0; i--) {
    if (diff > 0) { seatsPerRow[i]++; diff--; }
    else if (diff < 0 && seatsPerRow[i] > 0) { seatsPerRow[i]--; diff++; }
  }

  for (let r = 0; r < rows; r++) {
    const radius = innerRadius + r * rowGap + rowGap / 2;
    const n = seatsPerRow[r];
    if (n === 0) continue;

    const padding = 0.08; // kis padding a széleken
    for (let i = 0; i < n; i++) {
      const angle = padding + ((Math.PI - 2 * padding) * i) / (n - 1 || 1);
      positions.push({
        x: -radius * Math.cos(angle),
        y: -radius * Math.sin(angle),
      });
    }
  }

  return positions;
}

export default function HemicycleChart({ seats, partyColors, partyNames, majority, supermajority }: HemicycleProps) {
  const svgRef = useRef<SVGSVGElement>(null);

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

    // Székek kirajzolása pártszín szerint
    // Sorrend: bal → jobb (ellenzék → kormánypárt)
    const sortedParties = Object.entries(seats)
      .filter(([, s]) => s > 0)
      .sort((a, b) => {
        // Fidesz jobbra, többi balra
        const order: Record<string, number> = {
          dk: 0, mszp: 1, lmp: 2, mkkp: 3, egyseges_ellenzek: 4,
          tisza: 5, mi_hazank: 6, other: 7, jobbik: 8, fidesz_kdnp: 9,
        };
        return (order[a[0]] ?? 5) - (order[b[0]] ?? 5);
      });

    const seatData: SeatData[] = [];
    let seatIndex = 0;
    for (const [party, count] of sortedParties) {
      for (let i = 0; i < count && seatIndex < positions.length; i++) {
        seatData.push({
          party,
          color: partyColors[party] || '#999',
          x: positions[seatIndex].x,
          y: positions[seatIndex].y,
        });
        seatIndex++;
      }
    }

    // Többségi vonal (100 mandátum)
    const majorityPos = positions[99]; // 100. szék pozíciója
    if (majorityPos) {
      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', majorityPos.x * 1.15).attr('y2', majorityPos.y * 1.15)
        .attr('stroke', '#555')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4');

      g.append('text')
        .attr('x', majorityPos.x * 1.22)
        .attr('y', majorityPos.y * 1.22)
        .attr('fill', '#777')
        .attr('font-size', '10px')
        .attr('text-anchor', 'middle')
        .text('100');
    }

    // Kétharmad vonal (133 mandátum)
    const superPos = positions[132]; // 133. szék
    if (superPos) {
      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', superPos.x * 1.15).attr('y2', superPos.y * 1.15)
        .attr('stroke', '#555')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4');

      g.append('text')
        .attr('x', superPos.x * 1.22)
        .attr('y', superPos.y * 1.22)
        .attr('fill', '#777')
        .attr('font-size', '10px')
        .attr('text-anchor', 'middle')
        .text('⅔');
    }

    // Székek rajzolása animációval
    g.selectAll('circle.seat')
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
      .transition()
      .duration(500)
      .delay((_d, i) => i * 3)
      .attr('r', 6);

    // Központi szöveg
    if (majority) {
      const majorityName = partyNames[majority] || majority;
      const majoritySeats = seats[majority] || 0;

      g.append('text')
        .attr('x', 0)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .attr('fill', partyColors[majority] || '#fff')
        .attr('font-size', '36px')
        .attr('font-weight', 'bold')
        .attr('font-family', 'JetBrains Mono, monospace')
        .text(majoritySeats);

      g.append('text')
        .attr('x', 0)
        .attr('y', -15)
        .attr('text-anchor', 'middle')
        .attr('fill', '#ccc')
        .attr('font-size', '14px')
        .text(majorityName);

      if (supermajority) {
        g.append('text')
          .attr('x', 0)
          .attr('y', 5)
          .attr('text-anchor', 'middle')
          .attr('fill', '#fbbf24')
          .attr('font-size', '12px')
          .attr('font-weight', 'bold')
          .text('KETHARMAD');
      }
    } else {
      g.append('text')
        .attr('x', 0)
        .attr('y', -25)
        .attr('text-anchor', 'middle')
        .attr('fill', '#999')
        .attr('font-size', '16px')
        .text('Nincs többség');
    }

  }, [seats, partyColors, partyNames, majority, supermajority]);

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-400 mb-2">Parlamenti patkó</h3>
      <svg
        ref={svgRef}
        className="w-full max-w-[600px] mx-auto"
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  );
}
