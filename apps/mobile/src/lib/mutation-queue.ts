import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useEffect } from "react";
import { useNetworkState } from "expo-network";
import { trackEvent } from "@reelmate/core/domain/analytics";
import { supabase } from "./supabase";

const QUEUE_KEY = "reelmate.mutationQueue";

export type QueuedMutationRpc =
  "upsert_user_film" | "add_diary_entry" | "add_film_line";

type QueuedMutation = {
  id: string;
  rpc: QueuedMutationRpc;
  payload: Record<string, unknown>;
};

async function readQueue(): Promise<QueuedMutation[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
}

async function writeQueue(queue: QueuedMutation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function ratingBucket(rating: number): string {
  if (rating <= 2) return "0.5-2";
  if (rating <= 3.5) return "2.5-3.5";
  return "4-5";
}

/** PRD 17.1: film_status_changed/film_rated/diary_entry_created/line_created (Sinematek). */
function trackMutationEvent(
  rpc: QueuedMutationRpc,
  payload: Record<string, unknown>,
): void {
  if (rpc === "upsert_user_film") {
    trackEvent("film_status_changed", {
      status: String(payload.p_status ?? ""),
      source: "library",
    });
    if (typeof payload.p_rating === "number") {
      trackEvent("film_rated", {
        ratingBucket: ratingBucket(payload.p_rating),
      });
    }
  } else if (rpc === "add_diary_entry") {
    trackEvent("diary_entry_created", {});
  } else if (rpc === "add_film_line") {
    trackEvent("line_created", {});
  }
}

async function enqueueMutation(
  rpc: QueuedMutationRpc,
  payload: Record<string, unknown>,
): Promise<void> {
  const queue = await readQueue();
  queue.push({ id: Crypto.randomUUID(), rpc, payload });
  await writeQueue(queue);
}

export async function getQueueSize(): Promise<number> {
  return (await readQueue()).length;
}

/** Sıradaki her mutasyonu sırayla dener; ağ/erişilemezlik hatasında kuyrukta bırakıp durur. */
export async function flushMutationQueue(): Promise<void> {
  let queue = await readQueue();
  while (queue.length > 0) {
    const next = queue[0];
    if (!next) break;
    const { error } = await supabase.rpc(next.rpc, next.payload);
    if (error) return;
    trackMutationEvent(next.rpc, next.payload);
    queue = queue.slice(1);
    await writeQueue(queue);
  }
}

/**
 * RPC'yi hemen dener; sunucuya ulaşılamıyorsa (uçak modu vb.) sessizce kuyruğa
 * ekler — kullanıcı için iyimser güncelleme (Faz 4 kabul: "uçak modunda eklenen
 * film bağlantı gelince senkronize oluyor").
 */
export async function callOrQueue(
  rpc: QueuedMutationRpc,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.rpc(rpc, payload);
  if (error) {
    await enqueueMutation(rpc, payload);
  } else {
    trackMutationEvent(rpc, payload);
  }
}

/** Bağlantı geldiğinde kuyruğu otomatik boşaltır. */
export function useMutationQueueFlush(): void {
  const network = useNetworkState();
  useEffect(() => {
    if (network.isConnected) {
      void flushMutationQueue();
    }
  }, [network.isConnected]);
}
