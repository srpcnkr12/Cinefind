-- Faz 3: Kimlik, profil, onboarding (PRD bölüm 9.1, 19).
-- `user_films`in bu fazda açılma gerekçesi için bkz. docs/adr/0006-user-films-pulled-forward.md.

-- ============================================================================
-- profiles
-- ============================================================================
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  -- Doğum tarihi onboarding'in ilk adımında girilir; trigger satırı null ile
  -- oluşturur. NULL DEĞİLSE 18 yaş kuralı veritabanı seviyesinde zorunludur.
  birthdate date,
  gender text check (gender in ('woman', 'man', 'nonbinary', 'other')),
  gender_custom text,
  show_gender boolean not null default true,
  interested_in text[] not null default '{}',
  intents text[] not null default '{}',
  bio text check (bio is null or char_length(bio) <= 500),
  city text,
  country_code text,
  age_min smallint not null default 18,
  age_max smallint not null default 55,
  max_distance_km smallint not null default 50,
  locale text not null default 'tr',
  is_private boolean not null default false,
  discoverable boolean not null default false,
  web_posts_public boolean not null default false,
  is_verified boolean not null default false,
  verification_status text,
  last_active_at timestamptz,
  onboarding_step text not null default 'birthdate',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_birthdate_18plus check (birthdate is null or birthdate <= (current_date - interval '18 years')),
  constraint profiles_intents_valid check (intents <@ array['dating', 'friendship', 'watch_buddy']::text[])
);

alter table profiles enable row level security;

-- Faz 3'te henüz bir keşfet/eşleşme özelliği yok; herkese açık bir profil
-- görünürlüğü politikası bilinçli olarak eklenmedi (bkz. Faz 3 planı). Faz 5
-- (Keşfet) `discoverable=true` satırlar için ayrı, alan kısıtlı bir görünüm/politika ekleyecek.
create policy "profiles_owner_select" on profiles for select using (auth.uid() = id);
create policy "profiles_owner_update" on profiles for update using (auth.uid() = id);

-- ============================================================================
-- profile_locations — yalnızca RPC/SECURITY DEFINER erişir, istemciye politika yok.
-- ============================================================================
create table profile_locations (
  user_id uuid primary key references profiles (id) on delete cascade,
  geog extensions.geography (point, 4326),
  geohash5 text,
  updated_at timestamptz not null default now()
);

alter table profile_locations enable row level security;
-- Kasıtlı olarak hiçbir select/insert/update politikası yok (PRD 14.2: "İstemciye
-- ham koordinat asla dönmez"). Yazma yalnızca SECURITY DEFINER RPC ile.

-- ============================================================================
-- profile_photos
-- ============================================================================
create table profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  storage_path text not null,
  position smallint not null check (position between 1 and 6),
  blurhash text,
  width integer,
  height integer,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  moderation_labels jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, position)
);

alter table profile_photos enable row level security;

create policy "profile_photos_owner_all" on profile_photos for all using (auth.uid() = user_id);
-- Kabul kriteri: onaysız fotoğraf başka kullanıcıya hiçbir sorguda dönmez.
create policy "profile_photos_approved_public_select" on profile_photos for select using (
  moderation_status = 'approved'
);

-- ============================================================================
-- profile_prompts
-- ============================================================================
create table profile_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  prompt_key text not null,
  answer text not null check (char_length(answer) <= 200),
  position smallint not null,
  unique (user_id, position)
);

alter table profile_prompts enable row level security;
create policy "profile_prompts_owner_all" on profile_prompts for all using (auth.uid() = user_id);

-- ============================================================================
-- consents — sürümlü, ekleme-yalnızca (append-only) geçmiş.
-- ============================================================================
create table consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  consent_type text not null check (
    consent_type in ('kvkk_notice', 'special_category_data', 'location', 'marketing', 'analytics')
  ),
  version text not null,
  granted_at timestamptz,
  revoked_at timestamptz
);

alter table consents enable row level security;
create policy "consents_owner_select" on consents for select using (auth.uid() = user_id);
create policy "consents_owner_insert" on consents for insert with check (auth.uid() = user_id);

-- ============================================================================
-- device_tokens
-- ============================================================================
create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  last_seen_at timestamptz not null default now(),
  unique (user_id, token)
);

alter table device_tokens enable row level security;
create policy "device_tokens_owner_all" on device_tokens for all using (auth.uid() = user_id);

-- ============================================================================
-- user_films (Faz 3 alt kümesi — bkz. ADR-0006; Faz 4'te genişletilecek)
-- ============================================================================
create table user_films (
  user_id uuid not null references profiles (id) on delete cascade,
  film_id uuid not null references films (id) on delete cascade,
  status text not null default 'none' check (status in ('watched', 'watchlist', 'none')),
  rating numeric(2, 1) check (rating is null or (rating >= 0.5 and rating <= 5)),
  liked boolean,
  top_four_position smallint check (top_four_position between 1 and 4),
  updated_at timestamptz not null default now(),
  primary key (user_id, film_id),
  unique (user_id, top_four_position)
);

alter table user_films enable row level security;
create policy "user_films_owner_all" on user_films for all using (auth.uid() = user_id);

-- ============================================================================
-- Yeni auth.users satırı için otomatik profil oluşturma
-- ============================================================================
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, onboarding_step) values (new.id, 'birthdate');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ============================================================================
-- RPC'ler
-- ============================================================================
create or replace function update_onboarding_step(new_step text)
returns void
language sql
security invoker
as $$
  update profiles set onboarding_step = new_step where id = auth.uid();
$$;

grant execute on function update_onboarding_step(text) to authenticated;

create or replace function set_top_four(film_ids uuid[])
returns void
language plpgsql
security invoker
as $$
begin
  if array_length(film_ids, 1) is distinct from 4 then
    raise exception 'Kadrajım tam olarak 4 film içermeli';
  end if;

  update user_films set top_four_position = null where user_id = auth.uid() and top_four_position is not null;

  for i in 1..4 loop
    insert into user_films (user_id, film_id, top_four_position, liked)
    values (auth.uid(), film_ids[i], i, true)
    on conflict (user_id, film_id)
    do update set top_four_position = excluded.top_four_position, liked = true, updated_at = now();
  end loop;
end;
$$;

grant execute on function set_top_four(uuid[]) to authenticated;

create or replace function submit_taste_reactions(reactions jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  r jsonb;
begin
  for r in select * from jsonb_array_elements(reactions) loop
    insert into user_films (user_id, film_id, status, liked, rating)
    values (
      auth.uid(),
      (r ->> 'filmId')::uuid,
      'watched',
      case r ->> 'reaction' when 'liked' then true when 'disliked' then false else null end,
      case r ->> 'reaction' when 'liked' then 4.5 when 'ok' then 3 when 'disliked' then 1.5 else null end
    )
    on conflict (user_id, film_id)
    do update set status = excluded.status, liked = excluded.liked, rating = excluded.rating, updated_at = now();
  end loop;
end;
$$;

grant execute on function submit_taste_reactions(jsonb) to authenticated;

-- profile_locations'a hiçbir RLS politikası verilmedi (PRD 14.2) — tek yazma yolu bu RPC.
create or replace function update_my_location(lat double precision, lng double precision)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into profile_locations (user_id, geog, updated_at)
  values (auth.uid(), extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography, now())
  on conflict (user_id) do update set geog = excluded.geog, updated_at = now();
end;
$$;

grant execute on function update_my_location(double precision, double precision) to authenticated;

create or replace function record_consent(p_consent_type text, p_version text)
returns void
language sql
security invoker
as $$
  insert into consents (user_id, consent_type, version, granted_at)
  values (auth.uid(), p_consent_type, p_version, now());
$$;

grant execute on function record_consent(text, text) to authenticated;

-- Zevk testi destesi: rastgele ~30 film (fixture/katalog çeşitliliğine güvenir).
create or replace function get_taste_test_deck(deck_size int default 30)
returns table (film_id uuid, slug text, title text, poster_path text, release_year int)
language sql
security invoker
as $$
  select f.id, f.slug, coalesce(ft.title, f.original_title), f.poster_path, extract(year from f.release_date)::int
  from films f
  left join film_translations ft on ft.film_id = f.id and ft.locale = 'tr'
  where f.tmdb_synced_at is not null and f.adult = false
  order by random()
  limit deck_size;
$$;

grant execute on function get_taste_test_deck(int) to authenticated;

-- ============================================================================
-- Storage: profil fotoğrafları
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', false)
on conflict (id) do nothing;

create policy "profile_photos_storage_owner_insert" on storage.objects
for insert with check (
  bucket_id = 'profile-photos' and (storage.foldername(name)) [1] = auth.uid()::text
);

create policy "profile_photos_storage_owner_delete" on storage.objects
for delete using (
  bucket_id = 'profile-photos' and (storage.foldername(name)) [1] = auth.uid()::text
);

create policy "profile_photos_storage_owner_select" on storage.objects
for select using (
  bucket_id = 'profile-photos' and (storage.foldername(name)) [1] = auth.uid()::text
);

create policy "profile_photos_storage_approved_select" on storage.objects
for select using (
  bucket_id = 'profile-photos'
  and exists (
    select 1 from public.profile_photos p
    where p.storage_path = storage.objects.name and p.moderation_status = 'approved'
  )
);
