import { describe, it, expect } from 'vitest';
import { dhondt, getThreshold } from '../dhondt';

describe('D\'Hondt módszer', () => {
  it('alapeset: 7 mandátum 4 párt között', () => {
    // Klasszikus Wikipedia példa
    const votes = new Map<string, number>([
      ['A', 100000],
      ['B', 80000],
      ['C', 30000],
      ['D', 20000],
    ]);

    const result = dhondt(votes, 7, 0);

    expect(result.get('A')).toBe(3);
    expect(result.get('B')).toBe(3);
    expect(result.get('C')).toBe(1);
    expect(result.get('D')).toBe(0);
  });

  it('küszöb kiszűri a kis pártokat', () => {
    const votes = new Map<string, number>([
      ['Fidesz', 44000],
      ['Tisza', 35000],
      ['MiHazank', 6000],
      ['MKKP', 4000],  // 4.44% < 5% küszöb
      ['Egyéb', 1000],  // 1.11% < 5% küszöb
    ]);

    // 5% küszöb: MKKP és Egyéb kiesik, nem szerepelnek az eredményben
    const result = dhondt(votes, 20, 0.05);

    expect(result.has('MKKP')).toBe(false);
    expect(result.has('Egyéb')).toBe(false);
    expect(result.get('Fidesz')).toBeGreaterThan(0);
    expect(result.get('Tisza')).toBeGreaterThan(0);
    // MiHazank 6.67% > 5%, küszöb felett van, kap mandátumot 20 mandátumból
    expect(result.get('MiHazank')).toBeGreaterThan(0);

    // Összesen 20 mandátum
    const total = Array.from(result.values()).reduce((a, b) => a + b, 0);
    expect(total).toBe(20);
  });

  it('93 mandátum magyar választási arányokkal', () => {
    const votes = new Map<string, number>([
      ['fidesz_kdnp', 2800000],
      ['tisza', 2200000],
      ['mi_hazank', 400000],
      ['dk', 200000],
    ]);

    const result = dhondt(votes, 93, 0.05);

    // Összesen 93 mandátumnak kell lennie
    const total = Array.from(result.values()).reduce((a, b) => a + b, 0);
    expect(total).toBe(93);

    // Fidesz-nek a legtöbb mandátumot kell kapnia
    expect(result.get('fidesz_kdnp')!).toBeGreaterThan(result.get('tisza')!);
  });

  it('üres szavazatokkal üres eredményt ad', () => {
    const votes = new Map<string, number>();
    const result = dhondt(votes, 10, 0.05);
    expect(result.size).toBe(0);
  });

  it('egy párt kapja az összes mandátumot ha egyedül van küszöb felett', () => {
    const votes = new Map<string, number>([
      ['A', 90000],
      ['B', 2000],
      ['C', 1000],
    ]);

    const result = dhondt(votes, 10, 0.05);
    expect(result.get('A')).toBe(10);
  });
});

describe('getThreshold', () => {
  it('1 párt: 5%', () => {
    expect(getThreshold(1)).toBe(0.05);
  });

  it('2 párt közös lista: 10%', () => {
    expect(getThreshold(2)).toBe(0.10);
  });

  it('3+ párt közös lista: 15%', () => {
    expect(getThreshold(3)).toBe(0.15);
    expect(getThreshold(6)).toBe(0.15);
  });
});
