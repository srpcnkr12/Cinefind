import type { SupabaseClient } from "@supabase/supabase-js";

export type BlockedUser = {
  userId: string;
  displayName: string | null;
  blockedAt: string;
};

type BlockedUserRow = {
  user_id: string;
  display_name: string | null;
  blocked_at: string;
};

export async function getBlockedUsers(
  db: SupabaseClient,
): Promise<BlockedUser[]> {
  const { data, error } = await db.rpc("get_blocked_users");
  if (error) throw new Error(`getBlockedUsers failed: ${error.message}`);
  return ((data ?? []) as BlockedUserRow[]).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    blockedAt: row.blocked_at,
  }));
}

export async function unblockUser(
  db: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await db.rpc("unblock_user", { p_user_id: userId });
  if (error) throw new Error(`unblockUser failed: ${error.message}`);
}

export type ConsentType =
  | "kvkk_notice"
  | "special_category_data"
  | "location"
  | "marketing"
  | "analytics";

export type Consent = {
  id: string;
  consentType: ConsentType;
  version: string;
  grantedAt: string | null;
  revokedAt: string | null;
};

type ConsentRow = {
  id: string;
  consent_type: ConsentType;
  version: string;
  granted_at: string | null;
  revoked_at: string | null;
};

export async function getConsents(db: SupabaseClient): Promise<Consent[]> {
  const { data, error } = await db
    .from("consents")
    .select("id, consent_type, version, granted_at, revoked_at")
    .order("granted_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`getConsents failed: ${error.message}`);
  return ((data ?? []) as ConsentRow[]).map((row) => ({
    id: row.id,
    consentType: row.consent_type,
    version: row.version,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
  }));
}

export async function recordConsent(
  db: SupabaseClient,
  consentType: ConsentType,
  version: string,
): Promise<void> {
  const { error } = await db.rpc("record_consent", {
    p_consent_type: consentType,
    p_version: version,
  });
  if (error) throw new Error(`recordConsent failed: ${error.message}`);
}

export async function revokeConsent(
  db: SupabaseClient,
  consentType: ConsentType,
): Promise<void> {
  const { error } = await db.rpc("revoke_consent", {
    p_consent_type: consentType,
  });
  if (error) throw new Error(`revokeConsent failed: ${error.message}`);
}

export async function requestAccountDeletion(
  db: SupabaseClient,
): Promise<void> {
  const { error } = await db.rpc("request_account_deletion");
  if (error) throw new Error(`requestAccountDeletion failed: ${error.message}`);
}

export type DataExportStatus = "queued" | "processing" | "done" | "failed";

export type DataExportRequest = {
  id: string;
  status: DataExportStatus;
  storagePath: string | null;
  expiresAt: string | null;
  requestedAt: string;
  completedAt: string | null;
};

type DataExportRequestRow = {
  id: string;
  status: DataExportStatus;
  storage_path: string | null;
  expires_at: string | null;
  requested_at: string;
  completed_at: string | null;
};

export async function requestDataExport(db: SupabaseClient): Promise<string> {
  const { data, error } = await db.rpc("request_data_export");
  if (error) throw new Error(`requestDataExport failed: ${error.message}`);
  return data as string;
}

export async function getDataExportStatus(
  db: SupabaseClient,
  requestId: string,
): Promise<DataExportRequest | null> {
  const { data, error } = await db
    .from("data_export_requests")
    .select("id, status, storage_path, expires_at, requested_at, completed_at")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(`getDataExportStatus failed: ${error.message}`);
  if (!data) return null;
  const row = data as DataExportRequestRow;
  return {
    id: row.id,
    status: row.status,
    storagePath: row.storage_path,
    expiresAt: row.expires_at,
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
  };
}

export async function getLatestDataExportRequest(
  db: SupabaseClient,
): Promise<DataExportRequest | null> {
  const { data, error } = await db
    .from("data_export_requests")
    .select("id, status, storage_path, expires_at, requested_at, completed_at")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error)
    throw new Error(`getLatestDataExportRequest failed: ${error.message}`);
  if (!data) return null;
  const row = data as DataExportRequestRow;
  return {
    id: row.id,
    status: row.status,
    storagePath: row.storage_path,
    expiresAt: row.expires_at,
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
  };
}
