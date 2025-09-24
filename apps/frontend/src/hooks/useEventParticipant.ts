"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Event, EventParticipant } from "@/lib/firestore";
import { buildApiUrl } from "@/lib/api";

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface ActiveEvent extends Event {
  surveyQuestions?: Array<{ id: number; question: string }>;
  participantCount?: number;
  [key: string]: any;
}

interface ParticipantRecord extends EventParticipant {
  [key: string]: any;
}

interface UseEventParticipantOptions {
  userId?: string | null;
  role?: string | null;
  includeParticipant?: boolean;
  autoJoinIfMissing?: boolean;
  enabled?: boolean;
}

interface UseEventParticipantResult {
  activeEvent: ActiveEvent | null;
  participant: ParticipantRecord | null;
  loading: boolean;
  error: string | null;
  isParticipant: boolean;
  refresh: () => Promise<ActiveEvent | null>;
}

const ACTIVE_EVENT_ENDPOINT = buildApiUrl('/events/active');

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const message = await response.text();
    throw new HttpError(message || "リクエストに失敗しました", response.status);
  }
  return response.json();
}

export function useEventParticipant(options: UseEventParticipantOptions): UseEventParticipantResult {
  const {
    userId,
    role,
    includeParticipant = true,
    autoJoinIfMissing = false,
    enabled = true,
  } = options;

  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);
  const [participant, setParticipant] = useState<ParticipantRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joinAttemptedForEvent = useRef<string | null>(null);

  useEffect(() => {
    joinAttemptedForEvent.current = null;
  }, [userId]);

  const fetchEventAndParticipant = useCallback(async (): Promise<ActiveEvent | null> => {
    if (!enabled) {
      setActiveEvent(null);
      setParticipant(null);
      return null;
    }

    setLoading(true);
    setError(null);
    let fetchedEvent: ActiveEvent | null = null;

    try {
      let eventData: ActiveEvent | null = null;

      try {
        eventData = await fetchJson<ActiveEvent>(ACTIVE_EVENT_ENDPOINT);
        setActiveEvent(eventData);
        fetchedEvent = eventData;
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) {
          setActiveEvent(null);
          setParticipant(null);
          setError(null);
          return null;
        }
        throw err;
      }

      if (!includeParticipant || !userId || !eventData) {
        setParticipant(null);
        return fetchedEvent;
      }

      const participants = await fetchJson<ParticipantRecord[]>(
        buildApiUrl(`/events/${eventData.id}/participants`)
      );

      let currentParticipant = participants.find((p) => p.userId === userId) || null;

      if (!currentParticipant && autoJoinIfMissing) {
        if (joinAttemptedForEvent.current !== eventData.id) {
          joinAttemptedForEvent.current = eventData.id;
          try {
            await fetchJson(
              buildApiUrl(`/events/${eventData.id}/participants`),
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
              }
            );

            const refreshedParticipants = await fetchJson<ParticipantRecord[]>(
              buildApiUrl(`/events/${eventData.id}/participants`)
            );
            currentParticipant = refreshedParticipants.find((p) => p.userId === userId) || null;
          } catch (joinError) {
            if (joinError instanceof HttpError) {
              setError(joinError.message || "イベントへの参加登録に失敗しました");
            } else if (joinError instanceof Error) {
              setError(joinError.message);
            } else {
              setError("イベントへの参加登録に失敗しました");
            }
          }
        }
      }

      setParticipant(currentParticipant);
      return fetchedEvent;
    } catch (err) {
      if (err instanceof HttpError) {
        setError(err.message || "イベント情報の取得に失敗しました");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("イベント情報の取得に失敗しました");
      }
      setParticipant(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, includeParticipant, userId, autoJoinIfMissing]);

  useEffect(() => {
    fetchEventAndParticipant();
  }, [fetchEventAndParticipant, role]);

  const refresh = useCallback(async () => {
    return fetchEventAndParticipant();
  }, [fetchEventAndParticipant]);

  return {
    activeEvent,
    participant,
    loading,
    error,
    isParticipant: !!participant,
    refresh,
  };
}

export default useEventParticipant;
