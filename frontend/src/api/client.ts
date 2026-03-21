/**
 * API client — thin wrappers around fetch for the Flask backend.
 */

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5001';

export interface PersonaInfo {
  name: string;
  display_name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  color: string;
  documents: string[];
  profile: Record<string, unknown>;
}

export interface SessionInfo {
  session_id: string;
  persona: string;
  status: 'idle' | 'running' | 'done' | 'error';
  error?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export function listPersonas(): Promise<PersonaInfo[]> {
  return request<PersonaInfo[]>('/api/personas');
}

export function createSession(persona: string): Promise<SessionInfo> {
  return request<SessionInfo>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ persona }),
  });
}

export function runSession(sessionId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/api/sessions/${sessionId}/run`, {
    method: 'POST',
  });
}

export function getSession(sessionId: string): Promise<SessionInfo> {
  return request<SessionInfo>(`/api/sessions/${sessionId}`);
}

export function getFormState(sessionId: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/api/sessions/${sessionId}/form`);
}

export function getScore(sessionId: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/api/sessions/${sessionId}/score`);
}

export function deleteSession(sessionId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export function getSSEUrl(sessionId: string): string {
  return `${BASE_URL}/api/sessions/${sessionId}/stream`;
}

export async function createPersona(formData: FormData): Promise<PersonaInfo> {
  const res = await fetch(`${BASE_URL}/api/personas`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<PersonaInfo>;
}
