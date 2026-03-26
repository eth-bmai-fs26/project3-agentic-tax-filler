/**
 * @file SessionContext.tsx - Agent Session State Management Context
 *
 * This file manages the lifecycle of an AI agent session. A "session" is
 * created when a user selects a persona on the dashboard and clicks "Start."
 * The session tracks:
 *   - Which persona was selected
 *   - The unique session ID from the backend
 *   - Whether the agent is idle, running, done, or errored
 *   - How many form fields the agent has filled in so far
 *   - The final accuracy score (once the agent finishes)
 *
 * Key responsibilities:
 *   1. Starting a session: creates it on the backend, then starts the agent
 *   2. Polling: periodically fetches the latest form data from the backend
 *      and merges it into the FormContext (so the UI updates in real-time)
 *   3. Fallback status checking: every 5th poll, checks the session status
 *      in case SSE events were missed
 *   4. Cleanup: stops polling and resets state when needed
 *
 * How it fits into the project:
 *   SessionProvider wraps the app (inside FormProvider, inside HashRouter).
 *   Components use useSession() to access session state and actions.
 *   AgentSSEBridge (App.tsx) also updates session state when SSE events arrive.
 *   The polling mechanism here acts as a fallback to SSE for reliability.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { createSession, runSession, getFormState, getSession } from '../api/client';
import { useForm } from './FormContext';
import type { FormData } from '../types';

/**
 * AgentStatus - The possible states of the AI agent.
 *   - 'idle':    No agent is running (initial state or after reset)
 *   - 'running': The agent is actively processing documents and filling the form
 *   - 'done':    The agent has finished successfully
 *   - 'error':   The agent encountered an error and stopped
 */
export type AgentStatus = 'idle' | 'running' | 'done' | 'error';

/**
 * SessionContextType - Everything the SessionContext provides to components.
 *
 * Components call useSession() to get an object with this shape.
 */
interface SessionContextType {
  /** The unique session ID from the backend (null if no session is active) */
  sessionId: string | null;
  /** The name of the selected persona (null if none selected) */
  persona: string | null;
  /** Current status of the AI agent */
  agentStatus: AgentStatus;
  /** Final accuracy score (0-100), or null if not yet scored */
  scorePercent: number | null;
  /** Count of non-empty form fields filled by the agent (shown in the status bar) */
  fieldsFilledCount: number;
  /** Error message if agentStatus is 'error', otherwise null */
  errorMessage: string | null;
  /** Index of the form page the agent is currently working on */
  agentPageIndex: number;
  /** Start a new session for the given persona -- creates session, starts agent, begins polling */
  startSession: (persona: string) => Promise<void>;
  /** Stop the polling interval (called when agent finishes or errors) */
  stopPolling: () => void;
  /** Manually set the agent status (used by AgentSSEBridge when SSE events arrive) */
  setAgentStatus: (s: AgentStatus) => void;
  /** Manually set the score (used by AgentSSEBridge when agent_done event arrives) */
  setScorePercent: (n: number | null) => void;
  /** Reset everything back to initial state (clear session, stop polling) */
  resetSession: () => void;
}

/**
 * The React Context object for session state.
 * Initialized to null -- the actual value is provided by SessionProvider.
 */
const SessionContext = createContext<SessionContextType | null>(null);

/**
 * SessionProvider - The component that provides session state to the entire app.
 *
 * This wraps the app (inside FormProvider) and makes session data available
 * to every child component through React Context.
 *
 * @param {object} props
 * @param {ReactNode} props.children - The child components to wrap
 * @returns {JSX.Element} The context provider wrapping children
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  // ---- State variables ----
  // Each useState creates a piece of state that, when updated, triggers a re-render

  /** The unique session ID returned by the backend */
  const [sessionId, setSessionId] = useState<string | null>(null);
  /** The selected persona name (e.g., "alice") */
  const [persona, setPersona] = useState<string | null>(null);
  /** Current lifecycle status of the AI agent */
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  /** Final accuracy score after the agent finishes */
  const [scorePercent, setScorePercent] = useState<number | null>(null);
  /** How many form fields the agent has filled so far */
  const [fieldsFilledCount, setFieldsFilledCount] = useState(0);
  /** Error message if the agent failed */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Which form page the agent is currently working on (0-based index) */
  const [agentPageIndex, setAgentPageIndex] = useState(0);

  /**
   * pollRef stores the interval ID for the polling timer.
   * We use useRef (not useState) because:
   *   - Changing it should NOT trigger a re-render
   *   - We need the latest value inside async callbacks (closures)
   * It is either an interval ID (from setInterval) or null when not polling.
   */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Get the mergeFormData function from FormContext to update form data */
  const { mergeFormData } = useForm();

  /**
   * stopPolling - Clear the polling interval so we stop fetching from the backend.
   *
   * Called when:
   *   - The agent finishes (done or error)
   *   - A new session starts (to stop any old polling)
   *   - The session is reset
   */
  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /**
   * resetSession - Reset all session state back to initial values.
   *
   * Called when the user navigates back to the dashboard or wants to start fresh.
   * Stops any active polling and clears all session-related state.
   */
  const resetSession = useCallback(() => {
    stopPolling();
    setSessionId(null);
    setPersona(null);
    setAgentStatus('idle');
    setScorePercent(null);
    setFieldsFilledCount(0);
    setErrorMessage(null);
    setAgentPageIndex(0);
  }, [stopPolling]);

  /**
   * startSession - Create a new session, start the agent, and begin polling.
   *
   * This is the main function called when a user clicks "Start" on a persona card.
   * It performs these steps in order:
   *   1. Stop any existing polling (from a previous session)
   *   2. Reset all state to initial values
   *   3. Call the backend to create a new session for the selected persona
   *   4. Call the backend to start the AI agent
   *   5. Set up a polling interval that runs every 1.5 seconds to:
   *      a. Fetch the latest form data and merge it into FormContext
   *      b. Count how many fields have been filled
   *      c. Every 5th poll, check the session status as a fallback for SSE
   *
   * @param {string} selectedPersona - The persona name to start a session for
   */
  const startSession = useCallback(
    async (selectedPersona: string) => {
      // Step 1: Clean up any previous session's polling
      stopPolling();

      // Step 2: Reset all state to initial values
      setAgentStatus('idle');
      setScorePercent(null);
      setFieldsFilledCount(0);
      setErrorMessage(null);
      setAgentPageIndex(0);

      // Step 3: Ask the backend to create a new session
      const session = await createSession(selectedPersona);
      setSessionId(session.session_id);
      setPersona(selectedPersona);

      // Step 4: Tell the backend to start the AI agent
      await runSession(session.session_id);
      setAgentStatus('running');

      // Step 5: Start polling every 1.5 seconds to sync form data
      let pollIteration = 0; // Tracks how many polls have happened
      pollRef.current = setInterval(async () => {
        pollIteration++;
        try {
          // Fetch the latest form data from the backend
          const formData = await getFormState(session.session_id);

          // The backend includes metadata fields (prefixed with _) alongside form data.
          // We extract these before passing the data to FormContext.
          const rawData = formData as Record<string, unknown>;
          if (typeof rawData._page_index === 'number') {
            setAgentPageIndex(rawData._page_index);
          }

          // Remove internal metadata keys so they don't pollute the form data
          const cleanData = { ...rawData };
          delete cleanData._page_index;
          delete cleanData._current_page;

          // Merge the backend data into the form state (preserves user edits)
          mergeFormData(cleanData as unknown as FormData);

          // Count non-empty "leaf" values to track how many fields are filled.
          // A "leaf" is a value at the bottom of the object tree (not a container).
          // This gives the user a sense of progress (e.g., "47 fields filled").
          let count = 0;
          const countLeaves = (obj: unknown): void => {
            if (!obj || typeof obj !== 'object') return;
            // If it is an array, count each item's leaves
            if (Array.isArray(obj)) {
              for (const item of obj) countLeaves(item);
              return;
            }
            // For objects, iterate over properties
            for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
              if (k.startsWith('_')) continue; // Skip metadata keys
              if (typeof v === 'string' && v.trim()) count++; // Non-empty string = 1 filled field
              else if (typeof v === 'boolean' && v) count++;  // True boolean = 1 filled field
              else countLeaves(v); // Recurse into nested objects
            }
          };
          countLeaves(cleanData);
          setFieldsFilledCount(count);
        } catch {
          // If the backend is temporarily unreachable, silently ignore and try next poll.
          // This prevents a single network hiccup from crashing the UI.
        }

        // Every 5th poll (every ~7.5 seconds), check the session status directly.
        // This is a FALLBACK in case the SSE connection dropped and we missed the
        // agent_done or agent_error event. Without this, the UI could get stuck
        // showing "running" forever if SSE fails.
        if (pollIteration % 5 === 0) {
          try {
            const sessionInfo = await getSession(session.session_id);
            if (sessionInfo.status === 'done') {
              setAgentStatus('done');
              stopPolling();
            } else if (sessionInfo.status === 'error') {
              setAgentStatus('error');
              setErrorMessage(sessionInfo.error ?? 'Unknown error');
              stopPolling();
            }
          } catch {
            // Ignore errors -- this is just a fallback check
          }
        }
      }, 1500); // 1500ms = 1.5 seconds between each poll
    },
    [stopPolling, mergeFormData],
  );

  return (
    <SessionContext.Provider
      value={{
        sessionId,
        persona,
        agentStatus,
        scorePercent,
        fieldsFilledCount,
        errorMessage,
        agentPageIndex,
        startSession,
        stopPolling,
        setAgentStatus,
        setScorePercent,
        resetSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

/**
 * useSession - Custom hook to access the session context from any component.
 *
 * Usage in a component:
 *   const { agentStatus, startSession, sessionId } = useSession();
 *   // agentStatus -- check if agent is 'idle', 'running', 'done', or 'error'
 *   // startSession('alice') -- start a new session for the "alice" persona
 *   // sessionId -- the current session UUID (or null)
 *
 * This hook will throw an error if called from a component that is NOT
 * inside a <SessionProvider>. This is a safety check to catch mistakes early.
 *
 * @returns {SessionContextType} The session state and action functions
 * @throws {Error} If called outside of a SessionProvider
 */
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
