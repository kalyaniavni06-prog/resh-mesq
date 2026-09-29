/**
 * useOfflineSOSQueue
 *
 * When the device has no internet:
 *   - Saves the SOS payload to localStorage under "reshmesq.offline_sos_queue"
 *   - Returns { queued: number } so the UI can show a "queued" state
 *
 * When connectivity returns (window "online" event):
 *   - Drains every queued payload to Supabase (emergency_incidents table)
 *   - Clears the queue from localStorage on success
 *   - Fires onDrained callback with the number of items sent
 *
 * This hook registers/cleans up the online listener automatically.
 */

import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

type SOSPayload = TablesInsert<"emergency_incidents">;

const STORAGE_KEY = "reshmesq.offline_sos_queue";

function readQueue(): SOSPayload[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SOSPayload[];
  } catch {
    return [];
  }
}

function writeQueue(queue: SOSPayload[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full — best effort
  }
}

async function drainQueue(
  onDrained: (count: number) => void,
  onError: (msg: string) => void,
): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;

  // Get session once for all queued items
  const { data: { session } } = await supabase.auth.getSession();

  const results = await Promise.allSettled(
    queue.map((payload) => {
      const enriched: SOSPayload = {
        ...payload,
        created_by: session?.user.id ?? null,
      };
      return supabase.from("emergency_incidents").insert(enriched);
    }),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  // Remove successfully sent items; keep failed ones for next retry
  const remaining = queue.filter((_, i) => results[i]?.status !== "fulfilled");
  writeQueue(remaining);

  if (succeeded > 0) onDrained(succeeded);
  if (failed > 0)
    onError(`${failed} offline report(s) could not be sent and will retry on next connection.`);
}

interface UseOfflineSOSQueueOptions {
  onDrained?: (count: number) => void;
  onError?: (msg: string) => void;
}

export function useOfflineSOSQueue(options: UseOfflineSOSQueueOptions = {}) {
  const [queuedCount, setQueuedCount] = useState(() => readQueue().length);

  const refreshCount = useCallback(() => setQueuedCount(readQueue().length), []);

  // Enqueue a payload when offline (or as fallback)
  const enqueue = useCallback(
    (payload: SOSPayload): void => {
      const q = readQueue();
      q.push({ ...payload, created_at: payload.created_at ?? new Date().toISOString() });
      writeQueue(q);
      setQueuedCount(q.length);
    },
    [],
  );

  // Attempt to submit — online: go direct; offline: enqueue
  const submitOrEnqueue = useCallback(
    async (payload: SOSPayload): Promise<{ queued: boolean; reference?: string }> => {
      if (!navigator.onLine) {
        enqueue(payload);
        return { queued: true };
      }

      // Attach the current user's id when signed in, so the authenticated
      // RLS policy passes. When unauthenticated, keep created_by null to
      // satisfy the anon SOS policy (WITH CHECK (created_by IS NULL)).
      const { data: { session } } = await supabase.auth.getSession();
      const enriched: SOSPayload = {
        ...payload,
        created_by: session?.user.id ?? null,
      };

      const { data, error } = await supabase
        .from("emergency_incidents")
        .insert(enriched)
        .select("reference")
        .single();

      if (error) {
        // Provide a useful message before queuing
        const msg = error.code === "42501" || error.message.includes("permission")
          ? "Permission denied. Report queued for retry."
          : error.message;
        console.warn("[SOS] Insert failed:", msg, "— queuing locally.");
        enqueue(payload);
        return { queued: true };
      }
      return { queued: false, reference: data.reference };
    },
    [enqueue],
  );

  // Drain on reconnect
  useEffect(() => {
    const handleOnline = () => {
      drainQueue(
        (count) => {
          refreshCount();
          options.onDrained?.(count);
        },
        (msg) => options.onError?.(msg),
      );
    };

    window.addEventListener("online", handleOnline);

    // Also try draining immediately in case we're already online with a queue
    if (navigator.onLine && readQueue().length > 0) {
      drainQueue(
        (count) => {
          refreshCount();
          options.onDrained?.(count);
        },
        (msg) => options.onError?.(msg),
      );
    }

    return () => window.removeEventListener("online", handleOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { queuedCount, enqueue, submitOrEnqueue };
}

// ── Register the service worker (call once from app root) ────────────────────
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[SW] Registration failed:", err));
  });
}
