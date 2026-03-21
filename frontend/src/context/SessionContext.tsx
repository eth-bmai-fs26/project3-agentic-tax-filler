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

export type AgentStatus = 'idle' | 'running' | 'done' | 'error';

interface SessionContextType {
  sessionId: string | null;
  persona: string | null;
  agentStatus: AgentStatus;
  scorePercent: number | null;
  fieldsFilledCount: number;
  errorMessage: string | null;
  agentPageIndex: number;
  startSession: (persona: string) => Promise<void>;
  stopPolling: () => void;
  setAgentStatus: (s: AgentStatus) => void;
  setScorePercent: (n: number | null) => void;
  resetSession: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [persona, setPersona] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [scorePercent, setScorePercent] = useState<number | null>(null);
  const [fieldsFilledCount, setFieldsFilledCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [agentPageIndex, setAgentPageIndex] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { mergeFormData } = useForm();

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

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

  const startSession = useCallback(
    async (selectedPersona: string) => {
      stopPolling();
      setAgentStatus('idle');
      setScorePercent(null);
      setFieldsFilledCount(0);
      setErrorMessage(null);
      setAgentPageIndex(0);

      const session = await createSession(selectedPersona);
      setSessionId(session.session_id);
      setPersona(selectedPersona);

      await runSession(session.session_id);
      setAgentStatus('running');

      // Poll to sync form state from Flask, with fallback stop when agent is done
      let pollIteration = 0;
      pollRef.current = setInterval(async () => {
        pollIteration++;
        try {
          const formData = await getFormState(session.session_id);

          // Extract metadata before passing to form context
          const rawData = formData as Record<string, unknown>;
          if (typeof rawData._page_index === 'number') {
            setAgentPageIndex(rawData._page_index);
          }
          // Remove metadata keys before replacing form data
          const cleanData = { ...rawData };
          delete cleanData._page_index;
          delete cleanData._current_page;
          mergeFormData(cleanData as unknown as FormData);

          // Count non-empty leaf values as proxy for fields filled
          let count = 0;
          const countLeaves = (obj: unknown): void => {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
              for (const item of obj) countLeaves(item);
              return;
            }
            for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
              if (k.startsWith('_')) continue;
              if (typeof v === 'string' && v.trim()) count++;
              else if (typeof v === 'boolean' && v) count++;
              else countLeaves(v);
            }
          };
          countLeaves(cleanData);
          setFieldsFilledCount(count);
        } catch {
          // Ignore — backend may be temporarily busy
        }

        // Every 5 polls, check session status as SSE fallback
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
            // Ignore
          }
        }
      }, 1500);
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

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
