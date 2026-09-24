import type { SupabaseClient } from "@supabase/supabase-js";

export type ReportStatus = "open" | "in_review" | "actioned" | "dismissed";

export type ReportQueueItem = {
  id: string;
  reporterId: string;
  reporterDisplayName: string | null;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  assignedTo: string | null;
  createdAt: string;
};

type ReportQueueRow = {
  id: string;
  reporter_id: string;
  reporter_display_name: string | null;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  assigned_to: string | null;
  created_at: string;
};

export async function getReportQueue(
  db: SupabaseClient,
  status: ReportStatus = "open",
  cursor = 0,
  limit = 20,
): Promise<ReportQueueItem[]> {
  const { data, error } = await db.rpc("admin_list_reports", {
    p_status: status,
    p_cursor: cursor,
    p_limit: limit,
  });
  if (error) throw new Error(`getReportQueue failed: ${error.message}`);
  return ((data ?? []) as ReportQueueRow[]).map((row) => ({
    id: row.id,
    reporterId: row.reporter_id,
    reporterDisplayName: row.reporter_display_name,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
  }));
}

export type ReportDetail = ReportQueueItem & {
  contextSnapshot: Record<string, unknown>[] | null;
  resolution: string | null;
  resolvedAt: string | null;
};

type ReportDetailResult = ReportQueueRow & {
  context_snapshot: Record<string, unknown>[] | null;
  resolution: string | null;
  resolved_at: string | null;
};

export async function getReport(
  db: SupabaseClient,
  reportId: string,
): Promise<ReportDetail> {
  const { data, error } = await db.rpc("admin_get_report", {
    p_report_id: reportId,
  });
  if (error) throw new Error(`getReport failed: ${error.message}`);
  const row = data as ReportDetailResult;
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reporterDisplayName: row.reporter_display_name,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    contextSnapshot: row.context_snapshot,
    resolution: row.resolution,
    resolvedAt: row.resolved_at,
  };
}

export async function assignReport(
  db: SupabaseClient,
  reportId: string,
): Promise<void> {
  const { error } = await db.rpc("admin_assign_report", {
    p_report_id: reportId,
  });
  if (error) throw new Error(`assignReport failed: ${error.message}`);
}

export async function resolveReport(
  db: SupabaseClient,
  reportId: string,
  resolution: string,
  dismiss = false,
): Promise<void> {
  const { error } = await db.rpc("admin_resolve_report", {
    p_report_id: reportId,
    p_resolution: resolution,
    p_dismiss: dismiss,
  });
  if (error) throw new Error(`resolveReport failed: ${error.message}`);
}

export type User360 = {
  profile: Record<string, unknown>;
  reportsAgainst: number;
  reportsBy: number;
  moderationHistory: Record<string, unknown>[];
  matchCount: number;
  postCount: number;
  consents: Record<string, unknown>[];
};

type User360Result = {
  profile: Record<string, unknown>;
  reports_against: number;
  reports_by: number;
  moderation_history: Record<string, unknown>[];
  match_count: number;
  post_count: number;
  consents: Record<string, unknown>[];
};

export async function getUser360(
  db: SupabaseClient,
  userId: string,
): Promise<User360> {
  const { data, error } = await db.rpc("admin_get_user_360", {
    p_user_id: userId,
  });
  if (error) throw new Error(`getUser360 failed: ${error.message}`);
  const result = data as User360Result;
  return {
    profile: result.profile,
    reportsAgainst: result.reports_against,
    reportsBy: result.reports_by,
    moderationHistory: result.moderation_history,
    matchCount: result.match_count,
    postCount: result.post_count,
    consents: result.consents,
  };
}

export type ModerationTargetType = "photo" | "post" | "comment" | "line";

export async function removeContent(
  db: SupabaseClient,
  targetType: ModerationTargetType,
  targetId: string,
): Promise<void> {
  const { error } = await db.rpc("admin_remove_content", {
    p_target_type: targetType,
    p_target_id: targetId,
  });
  if (error) throw new Error(`removeContent failed: ${error.message}`);
}

export type ModerationAction =
  "warn" | "remove_content" | "suspend" | "ban" | "unban";

export async function moderateUser(
  db: SupabaseClient,
  targetUserId: string,
  action: ModerationAction,
  reason?: string,
  expiresAt?: string,
): Promise<void> {
  const { error } = await db.rpc("admin_moderate_user", {
    p_target_user_id: targetUserId,
    p_action: action,
    p_reason: reason ?? null,
    p_expires_at: expiresAt ?? null,
  });
  if (error) throw new Error(`moderateUser failed: ${error.message}`);
}

export type AppConfigEntry = { key: string; value: unknown };

export async function listAppConfig(
  db: SupabaseClient,
): Promise<AppConfigEntry[]> {
  const { data, error } = await db.rpc("admin_list_app_config");
  if (error) throw new Error(`listAppConfig failed: ${error.message}`);
  return (data ?? []) as AppConfigEntry[];
}

export async function setAppConfig(
  db: SupabaseClient,
  key: string,
  value: unknown,
): Promise<void> {
  const { error } = await db.rpc("admin_set_app_config", {
    p_key: key,
    p_value: value,
  });
  if (error) throw new Error(`setAppConfig failed: ${error.message}`);
}

export type Testimonial = {
  id: string;
  locale: "tr" | "en";
  quote: string;
  displayName: string;
  city: string | null;
  isPublished: boolean;
};

type TestimonialRow = {
  id: string;
  locale: "tr" | "en";
  quote: string;
  display_name: string;
  city: string | null;
  is_published: boolean;
};

export async function listTestimonials(
  db: SupabaseClient,
): Promise<Testimonial[]> {
  const { data, error } = await db.rpc("admin_list_testimonials");
  if (error) throw new Error(`listTestimonials failed: ${error.message}`);
  return ((data ?? []) as TestimonialRow[]).map((row) => ({
    id: row.id,
    locale: row.locale,
    quote: row.quote,
    displayName: row.display_name,
    city: row.city,
    isPublished: row.is_published,
  }));
}

export async function upsertTestimonial(
  db: SupabaseClient,
  input: {
    id?: string;
    locale: "tr" | "en";
    quote: string;
    displayName: string;
    city?: string;
    isPublished: boolean;
  },
): Promise<void> {
  const { error } = await db.rpc("admin_upsert_testimonial", {
    p_id: input.id ?? null,
    p_locale: input.locale,
    p_quote: input.quote,
    p_display_name: input.displayName,
    p_city: input.city ?? null,
    p_is_published: input.isPublished,
  });
  if (error) throw new Error(`upsertTestimonial failed: ${error.message}`);
}

export type AdminCollection = {
  id: string;
  slug: string;
  kind: string;
  isPublished: boolean;
  sortOrder: number;
  title: string | null;
  intro: string | null;
};

type AdminCollectionRow = {
  id: string;
  slug: string;
  kind: string;
  is_published: boolean;
  sort_order: number;
  title: string | null;
  intro: string | null;
};

export async function listAdminCollections(
  db: SupabaseClient,
): Promise<AdminCollection[]> {
  const { data, error } = await db.rpc("admin_list_collections");
  if (error) throw new Error(`listAdminCollections failed: ${error.message}`);
  return ((data ?? []) as AdminCollectionRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    isPublished: row.is_published,
    sortOrder: row.sort_order,
    title: row.title,
    intro: row.intro,
  }));
}

export async function setCollectionPublished(
  db: SupabaseClient,
  collectionId: string,
  isPublished: boolean,
): Promise<void> {
  const { error } = await db.rpc("admin_set_collection_published", {
    p_collection_id: collectionId,
    p_is_published: isPublished,
  });
  if (error) throw new Error(`setCollectionPublished failed: ${error.message}`);
}

export async function upsertCollectionTranslation(
  db: SupabaseClient,
  collectionId: string,
  locale: "tr" | "en",
  title: string,
  intro?: string,
): Promise<void> {
  const { error } = await db.rpc("admin_upsert_collection_translation", {
    p_collection_id: collectionId,
    p_locale: locale,
    p_title: title,
    p_intro: intro ?? null,
  });
  if (error)
    throw new Error(`upsertCollectionTranslation failed: ${error.message}`);
}
