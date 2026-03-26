/**
 * @file client.ts - API Client for the Flask Backend
 *
 * This file provides simple functions to communicate with the Flask backend
 * server. Each function corresponds to one API endpoint (one URL on the server).
 *
 * Think of this file as a "translator" between the React frontend and the
 * Python backend. Instead of writing `fetch(...)` calls everywhere in the
 * app, components call clean functions like `listPersonas()` or
 * `createSession('alice')`.
 *
 * How it fits into the project:
 *   React components/contexts --> client.ts functions --> Flask backend API
 *
 * Key concepts:
 *   - "fetch" is the browser's built-in function for making HTTP requests
 *   - Each function returns a Promise (the result will arrive later, asynchronously)
 *   - The generic `request<T>` helper handles JSON headers, error checking, and
 *     response parsing so individual functions stay short and clean
 */

/**
 * The base URL for all API requests.
 * It first checks for a VITE_API_URL environment variable (set in .env files),
 * and falls back to localhost:5001 if none is configured.
 * The `??` operator means "use the right side if the left side is null/undefined."
 */
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5001';

/**
 * PersonaInfo - Describes a test persona (a fictional taxpayer).
 *
 * Personas are pre-configured "characters" with different tax situations.
 * Students select a persona on the dashboard to start a tax filing session.
 */
export interface PersonaInfo {
  /** Internal identifier (e.g., "alice") */
  name: string;
  /** Human-readable name (e.g., "Alice Mueller") */
  display_name: string;
  /** Brief description of the persona's tax situation */
  description: string;
  /** How complex the tax scenario is */
  difficulty: 'easy' | 'medium' | 'hard';
  /** CSS color for the persona's card on the dashboard */
  color: string;
  /** List of document filenames associated with this persona */
  documents: string[];
  /** The persona's profile data (varies by persona) */
  profile: Record<string, unknown>;
}

/**
 * SessionInfo - Describes the state of an agent session on the backend.
 *
 * A "session" is created when a user picks a persona and starts the AI agent.
 * The backend tracks each session by a unique ID.
 */
export interface SessionInfo {
  /** Unique identifier for this session (a UUID string) */
  session_id: string;
  /** Which persona this session is using */
  persona: string;
  /** Current lifecycle status of the agent */
  status: 'idle' | 'running' | 'done' | 'error';
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Generic HTTP request helper.
 *
 * This is a private utility function used by all the exported API functions below.
 * It handles the repetitive parts of making API calls:
 *   1. Prepends the BASE_URL to the path
 *   2. Sets the Content-Type header to JSON
 *   3. Checks if the response was successful (HTTP 2xx)
 *   4. Parses the JSON response body
 *   5. Throws a descriptive error if something goes wrong
 *
 * The `<T>` is a TypeScript "generic" -- it lets callers specify what type
 * of data they expect back. For example, `request<PersonaInfo[]>(...)` means
 * "I expect an array of PersonaInfo objects."
 *
 * @template T - The expected shape of the JSON response
 * @param {string} path - The API endpoint path (e.g., "/api/personas")
 * @param {RequestInit} [options] - Optional fetch options (method, body, headers, etc.)
 * @returns {Promise<T>} The parsed JSON response
 * @throws {Error} If the HTTP response status is not OK (2xx)
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    // Set default JSON header, but allow callers to override with custom headers
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  // If the server returned an error status (4xx, 5xx), throw with details
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  // Parse the JSON response and cast it to the expected type T
  return res.json() as Promise<T>;
}

/**
 * Fetch the list of all available personas from the backend.
 *
 * Used by the Dashboard page to display persona cards that users can select.
 *
 * @returns {Promise<PersonaInfo[]>} Array of all configured personas
 */
export function listPersonas(): Promise<PersonaInfo[]> {
  return request<PersonaInfo[]>('/api/personas');
}

/**
 * Create a new agent session for the given persona.
 *
 * This tells the backend to set up a new session (allocate a session ID,
 * load the persona's documents, etc.) but does NOT start the agent yet.
 *
 * @param {string} persona - The persona name (e.g., "alice")
 * @returns {Promise<SessionInfo>} The newly created session info, including its ID
 */
export function createSession(persona: string): Promise<SessionInfo> {
  return request<SessionInfo>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ persona }),
  });
}

/**
 * Tell the backend to start running the AI agent for a session.
 *
 * After creating a session, you call this to actually kick off the agent.
 * The agent will begin reading the persona's documents and filling in the form.
 *
 * @param {string} sessionId - The session UUID returned by createSession
 * @returns {Promise<{status: string}>} Confirmation that the agent started
 */
export function runSession(sessionId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/api/sessions/${sessionId}/run`, {
    method: 'POST',
  });
}

/**
 * Get the current status of a session.
 *
 * Used to check whether the agent is still running, has finished, or has errored.
 * The frontend polls this endpoint as a fallback in case SSE events are missed.
 *
 * @param {string} sessionId - The session UUID
 * @returns {Promise<SessionInfo>} Current session info including status
 */
export function getSession(sessionId: string): Promise<SessionInfo> {
  return request<SessionInfo>(`/api/sessions/${sessionId}`);
}

/**
 * Get the current form data that the agent has filled in so far.
 *
 * The frontend polls this endpoint periodically while the agent is running
 * to show real-time updates of the form being filled in.
 *
 * @param {string} sessionId - The session UUID
 * @returns {Promise<Record<string, unknown>>} The form data as a JSON object
 */
export function getFormState(sessionId: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/api/sessions/${sessionId}/form`);
}

/**
 * Get the scoring results for a completed session.
 *
 * After the agent finishes, this endpoint returns how well the form was
 * filled in compared to the expected (correct) values.
 *
 * @param {string} sessionId - The session UUID
 * @returns {Promise<Record<string, unknown>>} Scoring data (score_percent, details, etc.)
 */
export function getScore(sessionId: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/api/sessions/${sessionId}/score`);
}

/**
 * Delete a session from the backend.
 *
 * Cleans up server-side resources when a session is no longer needed.
 *
 * @param {string} sessionId - The session UUID to delete
 * @returns {Promise<{deleted: boolean}>} Confirmation of deletion
 */
export function deleteSession(sessionId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

/**
 * Build the URL for the Server-Sent Events (SSE) stream of a session.
 *
 * SSE is a one-way channel where the server pushes events to the browser.
 * This URL is used by the useSSE hook to open an EventSource connection.
 *
 * Note: This does NOT make an HTTP request -- it just constructs the URL string.
 *
 * @param {string} sessionId - The session UUID
 * @returns {string} The full SSE stream URL
 */
export function getSSEUrl(sessionId: string): string {
  return `${BASE_URL}/api/sessions/${sessionId}/stream`;
}

/**
 * Create a new custom persona by uploading a form with files.
 *
 * Unlike other functions that send JSON, this one sends a FormData object
 * (multipart/form-data) because it needs to upload files (like PDF documents).
 * That is why it does NOT use the `request` helper -- the Content-Type header
 * must be set automatically by the browser for file uploads.
 *
 * @param {FormData} formData - A browser FormData object containing persona details and files
 * @returns {Promise<PersonaInfo>} The newly created persona info
 * @throws {Error} If the upload fails
 */
export async function createPersona(formData: FormData): Promise<PersonaInfo> {
  const res = await fetch(`${BASE_URL}/api/personas`, {
    method: 'POST',
    // Note: No Content-Type header! The browser sets it automatically for FormData,
    // including the multipart boundary string needed for file uploads.
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<PersonaInfo>;
}
