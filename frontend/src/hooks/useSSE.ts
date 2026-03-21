import { useEffect, useRef } from 'react';
import { getSSEUrl } from '../api/client';

export interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

export function useSSE(
  sessionId: string | null,
  onEvent: (e: SSEEvent) => void,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!sessionId) return;

    const url = getSSEUrl(sessionId);
    const es = new EventSource(url);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;

        // Dispatch ask_user events as custom window events for AskUserPopup
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

        onEventRef.current(data);
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // Connection errors are normal when stream ends — close quietly
      es.close();
    };

    return () => {
      es.close();
    };
  }, [sessionId]);
}
