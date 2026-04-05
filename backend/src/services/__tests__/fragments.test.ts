import { describe, it, expect } from 'vitest';
import { calculateFragmentVotes, aggregateFragmentVotes, OevkCandidateResult } from '../fragments';

describe('Töredékszavazat-számítás', () => {
  const eligibleParties = new Set(['fidesz_kdnp', 'tisza', 'mi_hazank']);

  it('alapeset: győztes töredék + vesztes szavazatok', () => {
    const candidates: OevkCandidateResult[] = [
      { party_id: 'fidesz_kdnp', votes: 30000, is_independent: false },
      { party_id: 'tisza', votes: 25000, is_independent: false },
      { party_id: 'mi_hazank', votes: 5000, is_independent: false },
    ];

    const fragments = calculateFragmentVotes(candidates, eligibleParties);

    // Győztes (Fidesz): 30000 - 25000 - 1 = 4999
    expect(fragments.get('fidesz_kdnp')).toBe(4999);
    // Vesztes (Tisza): 25000
    expect(fragments.get('tisza')).toBe(25000);
    // Vesztes (Mi Hazánk): 5000
    expect(fragments.get('mi_hazank')).toBe(5000);
  });

  it('független jelölt szavazatai nem számítanak', () => {
    const candidates: OevkCandidateResult[] = [
      { party_id: 'tisza', votes: 28000, is_independent: false },
      { party_id: 'fidesz_kdnp', votes: 22000, is_independent: false },
      { party_id: 'independent', votes: 8000, is_independent: true },
    ];

    const fragments = calculateFragmentVotes(candidates, eligibleParties);

    // Független nem kap töredéket
    expect(fragments.has('independent')).toBe(false);
    // Tisza győztes: 28000 - 22000 - 1 = 5999
    expect(fragments.get('tisza')).toBe(5999);
    // Fidesz vesztes: 22000
    expect(fragments.get('fidesz_kdnp')).toBe(22000);
  });

  it('küszöb alatti párt nem kap töredéket', () => {
    const candidates: OevkCandidateResult[] = [
      { party_id: 'fidesz_kdnp', votes: 30000, is_independent: false },
      { party_id: 'tisza', votes: 25000, is_independent: false },
      { party_id: 'kispárt', votes: 2000, is_independent: false },
    ];

    // kispárt nincs az eligible-ben
    const fragments = calculateFragmentVotes(candidates, eligibleParties);

    expect(fragments.has('kispárt')).toBe(false);
  });

  it('aggregálás több OEVK-ból', () => {
    const oevk1 = new Map([['fidesz_kdnp', 5000], ['tisza', 20000]]);
    const oevk2 = new Map([['fidesz_kdnp', 3000], ['tisza', 15000]]);
    const oevk3 = new Map([['fidesz_kdnp', 8000], ['mi_hazank', 4000]]);

    const total = aggregateFragmentVotes([oevk1, oevk2, oevk3]);

    expect(total.get('fidesz_kdnp')).toBe(16000);
    expect(total.get('tisza')).toBe(35000);
    expect(total.get('mi_hazank')).toBe(4000);
  });

  it('üres OEVK-val üres eredményt ad', () => {
    const fragments = calculateFragmentVotes([], eligibleParties);
    expect(fragments.size).toBe(0);
  });
});
