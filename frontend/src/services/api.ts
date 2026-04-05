import type { Party, Election, SimulationInput, SimulationResult } from '../types/election';

const BASE_URL = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || res.statusText);
  }
  return res.json();
}

export const api = {
  getParties: () => fetchJson<Party[]>('/parties'),

  getElections: () => fetchJson<Election[]>('/elections'),

  simulate: (input: SimulationInput) =>
    fetchJson<SimulationResult>('/simulate', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  saveSimulation: (name: string, description: string, config: SimulationInput) =>
    fetchJson<{ id: number }>('/simulations', {
      method: 'POST',
      body: JSON.stringify({ name, description, config }),
    }),

  getSimulations: () =>
    fetchJson<Array<{ id: number; name: string; created_at: string; description: string | null }>>('/simulations'),

  getSimulation: (id: number) =>
    fetchJson<{ id: number; name: string; config_json: string }>(`/simulations/${id}`),
};
