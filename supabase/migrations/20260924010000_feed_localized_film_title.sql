-- ============================================================================
-- Akış RPC'leri film adını `films.original_title`'dan alıyordu; Sinematek ve
-- diğer yüzeyler `film_translations` üzerinden Türkçe başlık gösterdiği için
-- akışta "Dry Summer", listede "Susuz Yaz" görünüyordu. Diğer RPC'lerdeki
-- `coalesce(ft.title, f.original_title)` deseniyle hizalanıyor.
-- ============================================================================

create or replace function get_following_feed(p_cursor int default 0, p_limit int default 20)
returns table (
  id uuid, author_id uuid, author_username text, author_display_name text,
  type text, film_id uuid, film_title text, film_poster_path text,
  line_id uuid, list_id uuid, body text, rating numeric, contains_spoiler boolean,
  repost_of_id uuid, quote_of_id uuid, visibility text,
  like_count int, comment_count int, repost_count int, bookmark_count int,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.author_id, pr.username, pr.display_name,
    p.type, p.film_id, coalesce(ft.title, f.original_title), f.poster_path,
    p.line_id, p.list_id, p.body, p.rating, p.contains_spoiler,
    p.repost_of_id, p.quote_of_id, p.visibility,
    p.like_count, p.comment_count, p.repost_count, p.bookmark_count,
    p.created_at
  from posts p
  join profiles pr on pr.id = p.author_id
  left join films f on f.id = p.film_id
  left join film_translations ft on ft.film_id = f.id and ft.locale = 'tr'
  where p.deleted_at is null
    and (
      p.author_id = auth.uid()
      or exists (select 1 from follows fo where fo.follower_id = auth.uid() and fo.followee_id = p.author_id and fo.status = 'accepted')
    )
    and can_view_post(auth.uid(), p.author_id, p.visibility)
  order by p.created_at desc
  limit p_limit offset p_cursor;
$$;

grant execute on function get_following_feed(int, int) to authenticated;

create or replace function get_discover_feed(p_cursor int default 0, p_limit int default 20)
returns table (
  id uuid, author_id uuid, author_username text, author_display_name text,
  type text, film_id uuid, film_title text, film_poster_path text,
  line_id uuid, list_id uuid, body text, rating numeric, contains_spoiler boolean,
  repost_of_id uuid, quote_of_id uuid, visibility text,
  like_count int, comment_count int, repost_count int, bookmark_count int,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.author_id, pr.username, pr.display_name,
    p.type, p.film_id, coalesce(ft.title, f.original_title), f.poster_path,
    p.line_id, p.list_id, p.body, p.rating, p.contains_spoiler,
    p.repost_of_id, p.quote_of_id, p.visibility,
    p.like_count, p.comment_count, p.repost_count, p.bookmark_count,
    p.created_at
  from posts p
  join profiles pr on pr.id = p.author_id
  left join films f on f.id = p.film_id
  left join film_translations ft on ft.film_id = f.id and ft.locale = 'tr'
  where p.deleted_at is null
    and p.author_id != auth.uid()
    and can_view_post(auth.uid(), p.author_id, p.visibility)
  order by (
    (case when p.film_id in (select film_id from user_films where user_id = auth.uid()) then 1 else 0 end) * 0.5
    + least(1.0, (p.like_count + p.comment_count) / 20.0) * 0.3
    + greatest(0, 1 - extract(epoch from (now() - p.created_at)) / (7 * 86400.0)) * 0.2
  ) desc
  limit p_limit offset p_cursor;
$$;

grant execute on function get_discover_feed(int, int) to authenticated;
