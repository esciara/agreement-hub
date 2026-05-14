import type { Contract, ContractInput } from './types';

// In development, Vite proxies /api → http://localhost:3001 (see vite.config.ts).
// For `npm run preview` or other non-dev environments, set VITE_API_BASE_URL
// to the full backend origin (e.g. http://localhost:3001).
const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api/contracts`
  : '/api/contracts';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error: string }).error || res.statusText);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export async function listContracts(): Promise<Contract[]> {
  const res = await fetch(API_BASE);
  return handleResponse<Contract[]>(res);
}

export async function getContract(id: string): Promise<Contract> {
  const res = await fetch(`${API_BASE}/${id}`);
  return handleResponse<Contract>(res);
}

export async function createContract(input: ContractInput): Promise<Contract> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<Contract>(res);
}

export async function updateContract(id: string, input: ContractInput): Promise<Contract> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<Contract>(res);
}

export async function deleteContract(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  return handleResponse<void>(res);
}
