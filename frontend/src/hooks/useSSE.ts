/**
 * @file useSSE.ts - Custom React Hook for Server-Sent Events (SSE)
 *
 * This file provides a React hook that listens for real-time events from
 * the Flask backend. SSE (Server-Sent Events) is a web technology that
 * allows the server to push updates to the browser over a single long-lived
 * HTTP connection.
 *
 * How SSE works (simplified):
 *   1. The browser opens a connection to the server (like loading a web page
 *      that never finishes loading)
 *   2. The server sends "events" (small JSON messages) whenever something
 *      happens (e.g., "the agent finished", "the agent has a question")
 *   3. The browser receives these events instantly without needing to ask
 *
 * Why we use SSE instead of just polling:
 *   - Polling means asking the server "anything new?" every few seconds,
 *     which wastes network requests when nothing has changed
 *   - SSE delivers updates instantly as they happen
 *   - However, we still use polling as a fallback (see SessionContext.tsx)
 *     in case the SSE connection drops
 *
 * How this fits into the project:
 *   AgentSSEBridge (in App.tsx) uses this hook to receive agent_done and
 *   agent_error events from the backend and update the session state.
 */

import { useEffect, useRef } from 'react';
import { getSSEUrl } from '../api/client';

/**
 * SSEEvent - The shape of an event received from the SSE stream.
 *
 * Every event has a `type` field (e.g., "agent_done", "agent_error", "ask_user")
 * plus any additional fields specific to that event type.
 * The `[key: string]: unknown` syntax means "any other properties are allowed."
 */
export interface SSEEvent {
  /** The event type identifier (e.g., "agent_done", "agent_error", "ask_user") */
  type: string;
  /** Additional event-specific fields (varies by event type) */
  [key: string]: unknown;
}

/**
 * useSSE - Custom React hook to subscribe to Server-Sent Events.
 *
 * This hook opens an EventSource connection to the backend when a sessionId
 * is provided, and calls the `onEvent` callback whenever an event arrives.
 *
 * Special behavior:
 *   - When an "ask_user" event arrives, it also dispatches a custom window
 *     event ('taxportal:askuser') so the AskUserPopup component can show it.
 *     This is a "pub/sub" pattern -- the popup listens for these window events.
 *   - The connection is automatically closed when the component unmounts or
 *     when the sessionId changes (React's useEffect cleanup).
 *   - Parse errors in event data are silently ignored.
 *
 * @param {string | null} sessionId - The active session ID, or null if no session.
 *   When null, no SSE connection is opened.
 * @param {(e: SSEEvent) => void} onEvent - Callback function invoked for each event.
 *   This is where you handle the event (e.g., update agent status).
 */
export function useSSE(
  sessionId: string | null,
  onEvent: (e: SSEEvent) => void,
) {
  // We store the onEvent callback in a ref so that the useEffect below
  // does not need to re-run every time the callback function reference changes.
  // This is a common React pattern: the ref always points to the latest version
  // of the callback, but changing it does not trigger the effect to re-run.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    // If there is no active session, do not open an SSE connection
    if (!sessionId) return;

    // Build the SSE URL and open a browser EventSource connection
    const url = getSSEUrl(sessionId);
    const es = new EventSource(url);

    // This handler fires every time the server sends an event
    es.onmessage = (event) => {
      try {
        // Parse the JSON string sent by the server into an object
        const data = JSON.parse(event.data) as SSEEvent;

        // Special handling for "ask_user" events:
        // The agent sometimes needs to ask the user a question (e.g., "What is
        // your marital status?"). We broadcast this as a custom window event
        // so the AskUserPopup component can pick it up and display a dialog.
        if (data.type === 'ask_user') {
          window.dispatchEvent(
            new CustomEvent('taxportal:askuser', {
              detail: {
                question: data.question,
                answer: data.answer,
                timestamp: Date.now(),
              },
            }),
          );
        }

        // Call the callback provided by the component using this hook
        onEventRef.current(data);
      } catch {
        // If the event data is not valid JSON, silently ignore it.
        // This can happen during connection setup or teardown.
      }
    };

    // Handle connection errors. SSE connections naturally close when the
    // server stops sending events (e.g., when the agent finishes).
    // This is expected behavior, not a real error, so we just close quietly.
    es.onerror = () => {
      es.close();
    };

    // Cleanup function: React calls this when the component unmounts or
    // when sessionId changes. It closes the SSE connection to prevent
    // memory leaks and stale event handlers.
    return () => {
      es.close();
    };
  }, [sessionId]); // Only re-run this effect when sessionId changes
}
