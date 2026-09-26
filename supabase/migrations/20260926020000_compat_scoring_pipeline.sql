-- ============================================================================
-- Uyum skoru hattı hiç çalışmıyordu.
--
-- Bulgular:
--  1. `compute-compat` için kayıtlı bir cron işi yoktu; skorlar yalnızca elle
--     tetiklenince hesaplanabiliyordu ve `compatibility_scores` boş kalmıştı.
--  2. `enqueue_compat_recompute` yalnızca RPC'lerin içinden `auth.uid()` ile
--     çağrılıyordu; servis rolüyle veya toplu yapılan `user_films` yazımları
--     (seed, içe aktarma, admin işlemleri) kuyruğa hiç düşmüyordu.
--  3. Edge function `compat_recompute_queue`'yu hiç okumuyordu, dolayısıyla
--     cron eklense bile kuyruğu boşaltacak bir yol yoktu.
--
-- Sonuç: `get_discovery_deck` her aday için nötr 0.5'e düşüyor ve kartlarda
-- herkes "%50 film uyumu" görünüyordu.
-- ============================================================================

-- ============================================================================
-- 1) Tablo seviyesinde kuyruk trigger'ı
-- ============================================================================
create or replace function user_films_enqueue_compat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `enqueue_compat_recompute` SECURITY INVOKER ve auth.uid()'e dayanıyor;
  -- burada satırın sahibini kullanıyoruz ki servis rolüyle yapılan yazımlar da
  -- kuyruğa düşsün.
  insert into compat_recompute_queue (user_id, queued_at)
  values (coalesce(new.user_id, old.user_id), now())
  on conflict (user_id) do update set queued_at = excluded.queued_at;
  return coalesce(new, old);
end;
$$;

drop trigger if exists user_films_compat_queue on user_films;
create trigger user_films_compat_queue
after insert or update or delete on user_films
for each row
execute function user_films_enqueue_compat();

-- ============================================================================
-- 2) Skorlanacak adayları seçen yardımcı
-- ============================================================================
-- `get_discovery_deck`'in SERT filtrelerini yansıtır (karşılıklı cinsiyet/niyet,
-- yaş aralığı, mesafe, keşfedilebilirlik). Gösterime özgü filtreler (kaydırma
-- geçmişi, günlük gösterim limiti, engelleme) burada UYGULANMAZ: onlar deste
-- üretilirken değerlendirilir, skorun kendisi kalıcı ve kişiden bağımsızdır.
create or replace function get_compat_candidates(p_user_id uuid, p_limit int default 100)
returns table (candidate_id uuid)
language sql
security definer
set search_path = public, extensions
stable
as $$
  with me as (
    select p.id, p.birthdate, p.gender, p.interested_in, p.intents,
           p.age_min, p.age_max, p.max_distance_km, pl.geog
    from profiles p
    left join profile_locations pl on pl.user_id = p.id
    where p.id = p_user_id
  )
  select p.id
  from profiles p
  cross join me
  left join profile_locations pl on pl.user_id = p.id
  where p.id <> me.id
    and p.discoverable = true
    and p.deleted_at is null
    and p.onboarding_step = 'completed'
    and p.birthdate is not null
    and me.birthdate is not null
    and extract(year from age(p.birthdate))::int between me.age_min and me.age_max
    and extract(year from age(me.birthdate))::int between p.age_min and p.age_max
    and p.gender = any(me.interested_in)
    and me.gender = any(p.interested_in)
    and p.intents && me.intents
    and (
      me.geog is null
      or pl.geog is null
      or extensions.st_dwithin(
        me.geog, pl.geog, least(me.max_distance_km, p.max_distance_km) * 1000
      )
    )
  limit p_limit;
$$;

revoke execute on function get_compat_candidates(uuid, int) from public, anon, authenticated;
grant execute on function get_compat_candidates(uuid, int) to service_role;

-- ============================================================================
-- 3) Kuyruğu okuyan/temizleyen yardımcılar (Edge Function bunları kullanır)
-- ============================================================================
create or replace function claim_compat_queue(p_limit int default 20)
returns table (user_id uuid)
language sql
security definer
set search_path = public
as $$
  delete from compat_recompute_queue q
  where q.user_id in (
    select q2.user_id from compat_recompute_queue q2
    order by q2.queued_at
    limit p_limit
    for update skip locked
  )
  returning q.user_id;
$$;

revoke execute on function claim_compat_queue(int) from public, anon, authenticated;
grant execute on function claim_compat_queue(int) to service_role;

-- ============================================================================
-- 4) compute-compat cron'u
-- ============================================================================
-- Diğer cron işleriyle aynı uyarı geçerli: yalnızca Vault'ta 'project_url' ve
-- 'service_role_key' secret'ları tanımlıysa fiilen çalışır (yerelde kayıtlıdır
-- ama tetiklendiğinde başarısız olur; yerel doğrulama doğrudan HTTP çağrısıyla
-- yapılır).
select cron.schedule(
  'compute_compat_every_15_min',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/compute-compat',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{"mode":"queue"}'::jsonb
    ) as request_id;
  $$
);
