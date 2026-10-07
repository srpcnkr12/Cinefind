import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FollowStatus,
  NotificationType,
  PostType,
  PostVisibility,
} from "@movieholix/core/domain/social";
import { trackEvent } from "@movieholix/core/domain/analytics";

export type PostItem = {
  id: string;
  authorId: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  type: PostType;
  filmId: string | null;
  filmTitle: string | null;
  filmPosterPath: string | null;
  lineId: string | null;
  listId: string | null;
  body: string | null;
  rating: number | null;
  containsSpoiler: boolean;
  repostOfId: string | null;
  quoteOfId: string | null;
  visibility: PostVisibility;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  bookmarkCount: number;
  createdAt: string;
};

type PostFeedRow = {
  id: string;
  author_id: string;
  author_username: string | null;
  author_display_name: string | null;
  type: PostType;
  film_id: string | null;
  film_title: string | null;
  film_poster_path: string | null;
  line_id: string | null;
  list_id: string | null;
  body: string | null;
  rating: number | null;
  contains_spoiler: boolean;
  repost_of_id: string | null;
  quote_of_id: string | null;
  visibility: PostVisibility;
  like_count: number;
  comment_count: number;
  repost_count: number;
  bookmark_count: number;
  created_at: string;
};

function mapPost(row: PostFeedRow): PostItem {
  return {
    id: row.id,
    authorId: row.author_id,
    authorUsername: row.author_username,
    authorDisplayName: row.author_display_name,
    type: row.type,
    filmId: row.film_id,
    filmTitle: row.film_title,
    filmPosterPath: row.film_poster_path,
    lineId: row.line_id,
    listId: row.list_id,
    body: row.body,
    rating: row.rating,
    containsSpoiler: row.contains_spoiler,
    repostOfId: row.repost_of_id,
    quoteOfId: row.quote_of_id,
    visibility: row.visibility,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    repostCount: row.repost_count,
    bookmarkCount: row.bookmark_count,
    createdAt: row.created_at,
  };
}

export async function getFollowingFeed(
  db: SupabaseClient,
  cursor = 0,
  limit = 20,
): Promise<PostItem[]> {
  const { data, error } = await db.rpc("get_following_feed", {
    p_cursor: cursor,
    p_limit: limit,
  });
  if (error) throw new Error(`getFollowingFeed failed: ${error.message}`);
  return ((data ?? []) as PostFeedRow[]).map(mapPost);
}

export async function getDiscoverFeed(
  db: SupabaseClient,
  cursor = 0,
  limit = 20,
): Promise<PostItem[]> {
  const { data, error } = await db.rpc("get_discover_feed", {
    p_cursor: cursor,
    p_limit: limit,
  });
  if (error) throw new Error(`getDiscoverFeed failed: ${error.message}`);
  return ((data ?? []) as PostFeedRow[]).map(mapPost);
}

export type CreatePostInput = {
  type: PostType;
  body?: string;
  filmId?: string;
  lineId?: string;
  listId?: string;
  rating?: number;
  containsSpoiler?: boolean;
  visibility?: PostVisibility;
  repostOfId?: string;
  quoteOfId?: string;
};

export async function createPost(
  db: SupabaseClient,
  input: CreatePostInput,
): Promise<{ id: string }> {
  const { data, error } = await db.rpc("create_post", {
    p_type: input.type,
    p_body: input.body ?? null,
    p_film_id: input.filmId ?? null,
    p_line_id: input.lineId ?? null,
    p_list_id: input.listId ?? null,
    p_rating: input.rating ?? null,
    p_contains_spoiler: input.containsSpoiler ?? false,
    p_visibility: input.visibility ?? "public",
    p_repost_of_id: input.repostOfId ?? null,
    p_quote_of_id: input.quoteOfId ?? null,
  });
  if (error) throw error;
  trackEvent("post_created", {
    type: input.type,
    hasSpoiler: input.containsSpoiler ?? false,
  });
  return { id: (data as { id: string }).id };
}

export async function deletePost(
  db: SupabaseClient,
  postId: string,
): Promise<void> {
  const { error } = await db.rpc("delete_post", { p_post_id: postId });
  if (error) throw new Error(`deletePost failed: ${error.message}`);
}

export type CommentItem = {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  containsSpoiler: boolean;
  likeCount: number;
  createdAt: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  contains_spoiler: boolean;
  like_count: number;
  created_at: string;
};

export async function getComments(
  db: SupabaseClient,
  postId: string,
): Promise<CommentItem[]> {
  const { data, error } = await db
    .from("comments")
    .select(
      "id, post_id, author_id, parent_id, body, contains_spoiler, like_count, created_at",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getComments failed: ${error.message}`);
  return ((data ?? []) as CommentRow[]).map((row) => ({
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    parentId: row.parent_id,
    body: row.body,
    containsSpoiler: row.contains_spoiler,
    likeCount: row.like_count,
    createdAt: row.created_at,
  }));
}

export async function addComment(
  db: SupabaseClient,
  postId: string,
  body: string,
  parentId?: string,
  containsSpoiler = false,
): Promise<CommentItem> {
  const { data, error } = await db.rpc("add_comment", {
    p_post_id: postId,
    p_body: body,
    p_parent_id: parentId ?? null,
    p_contains_spoiler: containsSpoiler,
  });
  if (error) throw error;
  trackEvent("comment_created", {});
  const row = data as CommentRow;
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    parentId: row.parent_id,
    body: row.body,
    containsSpoiler: row.contains_spoiler,
    likeCount: row.like_count,
    createdAt: row.created_at,
  };
}

export async function togglePostLike(
  db: SupabaseClient,
  postId: string,
): Promise<boolean> {
  const { data, error } = await db.rpc("toggle_post_like", {
    p_post_id: postId,
  });
  if (error) throw new Error(`togglePostLike failed: ${error.message}`);
  const liked = data as boolean;
  if (liked) trackEvent("post_liked", {});
  return liked;
}

export async function toggleCommentLike(
  db: SupabaseClient,
  commentId: string,
): Promise<boolean> {
  const { data, error } = await db.rpc("toggle_comment_like", {
    p_comment_id: commentId,
  });
  if (error) throw new Error(`toggleCommentLike failed: ${error.message}`);
  return data as boolean;
}

export async function toggleBookmark(
  db: SupabaseClient,
  postId: string,
): Promise<boolean> {
  const { data, error } = await db.rpc("toggle_bookmark", {
    p_post_id: postId,
  });
  if (error) throw new Error(`toggleBookmark failed: ${error.message}`);
  return data as boolean;
}

export async function requestFollow(
  db: SupabaseClient,
  followeeId: string,
): Promise<FollowStatus> {
  const { data, error } = await db.rpc("request_follow", {
    p_followee_id: followeeId,
  });
  if (error) throw new Error(`requestFollow failed: ${error.message}`);
  trackEvent("follow_requested", {});
  return data as FollowStatus;
}

export async function respondToFollowRequest(
  db: SupabaseClient,
  followerId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await db.rpc("respond_to_follow_request", {
    p_follower_id: followerId,
    p_accept: accept,
  });
  if (error) throw new Error(`respondToFollowRequest failed: ${error.message}`);
}

export async function unfollow(
  db: SupabaseClient,
  followeeId: string,
): Promise<void> {
  const { error } = await db.rpc("unfollow", { p_followee_id: followeeId });
  if (error) throw new Error(`unfollow failed: ${error.message}`);
}

export type NotificationItem = {
  id: string;
  type: NotificationType;
  actorId: string | null;
  entity: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  type: NotificationType;
  actor_id: string | null;
  entity: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export async function getNotifications(
  db: SupabaseClient,
  cursor = 0,
  limit = 30,
): Promise<NotificationItem[]> {
  const { data, error } = await db.rpc("get_notifications", {
    p_cursor: cursor,
    p_limit: limit,
  });
  if (error) throw new Error(`getNotifications failed: ${error.message}`);
  return ((data ?? []) as NotificationRow[]).map((row) => ({
    id: row.id,
    type: row.type,
    actorId: row.actor_id,
    entity: row.entity,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

export async function markNotificationRead(
  db: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await db.rpc("mark_notification_read", { p_id: id });
  if (error) throw new Error(`markNotificationRead failed: ${error.message}`);
}

export type UserListItem = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
};

export async function getUserLists(
  db: SupabaseClient,
  ownerId: string,
): Promise<UserListItem[]> {
  const { data, error } = await db
    .from("user_lists")
    .select("id, owner_id, title, description")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getUserLists failed: ${error.message}`);
  return (
    (data ?? []) as {
      id: string;
      owner_id: string;
      title: string;
      description: string | null;
    }[]
  ).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
  }));
}

export async function createList(
  db: SupabaseClient,
  title: string,
  description?: string,
): Promise<UserListItem> {
  const { data, error } = await db.rpc("create_list", {
    p_title: title,
    p_description: description ?? null,
  });
  if (error) throw error;
  const row = data as {
    id: string;
    owner_id: string;
    title: string;
    description: string | null;
  };
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
  };
}

export async function addListItem(
  db: SupabaseClient,
  listId: string,
  filmId: string,
): Promise<void> {
  const { error } = await db.rpc("add_list_item", {
    p_list_id: listId,
    p_film_id: filmId,
  });
  if (error) throw new Error(`addListItem failed: ${error.message}`);
}

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  isPrivate: boolean;
  intents: string[];
  isFollowing: boolean;
  followStatus: FollowStatus | null;
  isFollowedBy: boolean;
};

type PublicProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_private: boolean;
  intents: string[];
  is_following: boolean;
  follow_status: FollowStatus | null;
  is_followed_by: boolean;
};

export async function getPublicProfile(
  db: SupabaseClient,
  username: string,
): Promise<PublicProfile | null> {
  const { data, error } = await db.rpc("get_public_profile", {
    p_username: username,
  });
  if (error) throw new Error(`getPublicProfile failed: ${error.message}`);
  const row = (data as PublicProfileRow[] | null)?.[0];
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    isPrivate: row.is_private,
    intents: row.intents,
    isFollowing: row.is_following,
    followStatus: row.follow_status,
    isFollowedBy: row.is_followed_by,
  };
}
