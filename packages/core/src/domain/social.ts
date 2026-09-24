import { z } from "zod";

/** PRD bölüm 9.4 — sosyal akış domain tipleri. */

export const postTypeSchema = z.enum([
  "text",
  "review",
  "line",
  "list",
  "watched",
]);
export type PostType = z.infer<typeof postTypeSchema>;

export const postVisibilitySchema = z.enum(["public", "followers"]);
export type PostVisibility = z.infer<typeof postVisibilitySchema>;

export const followStatusSchema = z.enum(["pending", "accepted"]);
export type FollowStatus = z.infer<typeof followStatusSchema>;

export const notificationTypeSchema = z.enum([
  "new_message",
  "mention",
  "follow_request",
  "follow_accepted",
  "like",
  "comment",
  "super_message",
  "weekly_stats_ready",
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

const USERNAME_PATTERN = /@([a-z0-9_]{2,30})/g;

/**
 * `@kullaniciadi` bahsetmelerini metinden ayıklar (küçük/büyük harf duyarsız).
 * SQL tarafındaki `process_mentions`'ın regex'iyle (`@([a-z0-9_]{2,30})`)
 * davranışça eşdeğer tutulmalı (bkz. ADR-0009'daki dual-runtime emsali).
 */
export function parseMentions(body: string | null | undefined): string[] {
  if (!body) return [];
  const seen = new Set<string>();
  for (const match of body.toLowerCase().matchAll(USERNAME_PATTERN)) {
    const username = match[1];
    if (username) seen.add(username);
  }
  return [...seen];
}
