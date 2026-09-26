BEGIN;
SELECT plan(10);

-- ============================================================================
-- Test kullanıcıları: A (biz), B (uygun aday), C (engellenen), D (banlı/silinmiş),
-- E (onaysız fotoğraf), F (mesafe testi için uzak).
-- ============================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'disc-a@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'disc-b@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'disc-c@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', 'disc-d@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-00000000000e', 'authenticated', 'authenticated', 'disc-e@test.com', '', now(), now(), now(), '{}', '{}');

update profiles set
  birthdate = '1995-01-01', gender = 'woman', interested_in = array['man'], intents = array['dating'],
  discoverable = true, last_active_at = now(), age_min = 18, age_max = 60, max_distance_km = 100,
  onboarding_step = 'completed'
where id in ('a0000000-0000-0000-0000-00000000000a');

update profiles set
  birthdate = '1993-01-01', gender = 'man', interested_in = array['woman'], intents = array['dating'],
  discoverable = true, last_active_at = now(), age_min = 18, age_max = 60, max_distance_km = 100,
  display_name = 'B', onboarding_step = 'completed'
where id in ('b0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000c',
             'd0000000-0000-0000-0000-00000000000d', 'e0000000-0000-0000-0000-00000000000e');

update profiles set deleted_at = now() where id = 'd0000000-0000-0000-0000-00000000000d';

-- Hepsi birbirine ~200 m mesafede, ama başka hiçbir profilin bulunmadığı ıssız
-- bir noktada (Atlantik ortası). Fixture'lar İstanbul'a konduğunda demo seed'inin
-- 60 kullanıcısı da A'nın 100 km yarıçapına giriyor, deste 20 kişiyle sınırlı
-- olduğu ve skorlamada rastgele bir "keşif" dilimi bulunduğu için B bazen
-- listeden düşüyor ve test rastgele başarısız oluyordu. Uzak bir konum testi
-- veritabanındaki diğer verilerden bağımsız kılar.
insert into profile_locations (user_id, geog) values
  ('a0000000-0000-0000-0000-00000000000a', extensions.st_setsrid(extensions.st_makepoint(-30.0000, 0.0000), 4326)::extensions.geography),
  ('b0000000-0000-0000-0000-00000000000b', extensions.st_setsrid(extensions.st_makepoint(-29.9984, 0.0008), 4326)::extensions.geography),
  ('c0000000-0000-0000-0000-00000000000c', extensions.st_setsrid(extensions.st_makepoint(-29.9984, 0.0008), 4326)::extensions.geography),
  ('d0000000-0000-0000-0000-00000000000d', extensions.st_setsrid(extensions.st_makepoint(-29.9984, 0.0008), 4326)::extensions.geography),
  ('e0000000-0000-0000-0000-00000000000e', extensions.st_setsrid(extensions.st_makepoint(-29.9984, 0.0008), 4326)::extensions.geography);

insert into profile_photos (user_id, storage_path, position, moderation_status) values
  ('b0000000-0000-0000-0000-00000000000b', 'b/1.jpg', 1, 'approved'),
  ('c0000000-0000-0000-0000-00000000000c', 'c/1.jpg', 1, 'approved'),
  ('d0000000-0000-0000-0000-00000000000d', 'd/1.jpg', 1, 'approved'),
  ('e0000000-0000-0000-0000-00000000000e', 'e/1.jpg', 1, 'pending');

-- A, C'yi engelliyor.
insert into blocks (blocker_id, blocked_id) values ('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000c');

-- `app_config`da yalnızca select politikası var; güncellemeler ayrıcalıklı
-- (superuser) bağlamda, `authenticated` rolüne geçmeden önce yapılmalı.
update app_config set value = '100' where key = 'max_daily_impressions';

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

-- ============================================================================
-- get_discovery_deck: B görünür; C (engellenen), D (silinmiş), E (onaysız foto) görünmez.
-- ============================================================================
select ok(
  exists (select 1 from get_discovery_deck() where user_id = 'b0000000-0000-0000-0000-00000000000b'),
  'uygun aday (B) deste içinde dönüyor'
);

select ok(
  not exists (select 1 from get_discovery_deck() where user_id = 'c0000000-0000-0000-0000-00000000000c'),
  'engellenen kullanıcı (C) destede asla dönmüyor'
);

select ok(
  not exists (select 1 from get_discovery_deck() where user_id = 'd0000000-0000-0000-0000-00000000000d'),
  'silinmiş/banlı kullanıcı (D) destede asla dönmüyor'
);

select ok(
  not exists (select 1 from get_discovery_deck() where user_id = 'e0000000-0000-0000-0000-00000000000e'),
  'onaysız fotoğraflı kullanıcı (E) destede asla dönmüyor'
);

select ok(
  (select distance_bucket from get_discovery_deck() where user_id = 'b0000000-0000-0000-0000-00000000000b') in ('<1', '1-5', '5-10', '10-25', '25+'),
  'mesafe yalnızca kova değeri olarak dönüyor, ham km asla değil'
);

-- ============================================================================
-- swipe: günlük limit
-- ============================================================================
reset role;
update app_config set value = '2' where key = 'free_daily_swipes';
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

-- `lives_ok`/`throws_ok` her biri kendi savepoint'inde çalışır; birikimli
-- `daily_usage` durumunu bir sonraki assertion'a taşımak için ilk iki swipe
-- düz SQL olarak (pgTAP sarmalayıcısı olmadan) çalıştırılıyor.
select swipe('b0000000-0000-0000-0000-00000000000b', 'pass');
select swipe('c0000000-0000-0000-0000-00000000000c', 'pass');

select is(
  (select swipes_used from daily_usage where user_id = 'a0000000-0000-0000-0000-00000000000a'),
  2,
  'iki swipe sonrası kullanım sayacı 2''ye çıkıyor'
);

select throws_ok(
  $$ select swipe('d0000000-0000-0000-0000-00000000000d', 'pass') $$,
  'P0001', 'daily_limit_reached',
  'üçüncü swipe günlük limiti aştığı için reddediliyor'
);

reset role;
update app_config set value = '25' where key = 'free_daily_swipes';
delete from swipes where swiper_id = 'a0000000-0000-0000-0000-00000000000a';
delete from daily_usage where user_id = 'a0000000-0000-0000-0000-00000000000a';

-- ============================================================================
-- Karşılıklı beğenide tek eşleşme
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select swipe('b0000000-0000-0000-0000-00000000000b', 'like');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select swipe('a0000000-0000-0000-0000-00000000000a', 'like');
reset role;

select is(
  (select count(*)::int from matches where
    (user_low = least('a0000000-0000-0000-0000-00000000000a'::uuid, 'b0000000-0000-0000-0000-00000000000b'::uuid)
     and user_high = greatest('a0000000-0000-0000-0000-00000000000a'::uuid, 'b0000000-0000-0000-0000-00000000000b'::uuid))),
  1,
  'karşılıklı beğenide tam olarak tek bir eşleşme satırı oluşuyor'
);

select is(
  (select count(*)::int from conversations c join matches m on c.match_id = m.id
   where m.user_low = least('a0000000-0000-0000-0000-00000000000a'::uuid, 'b0000000-0000-0000-0000-00000000000b'::uuid)),
  1,
  'eşleşmeyle birlikte tek bir conversation oluşuyor'
);

-- ============================================================================
-- block_user: eşleşmeyi kapatıyor
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select block_user('b0000000-0000-0000-0000-00000000000b');
reset role;

select ok(
  (select unmatched_at from matches where
    user_low = least('a0000000-0000-0000-0000-00000000000a'::uuid, 'b0000000-0000-0000-0000-00000000000b'::uuid)
    and user_high = greatest('a0000000-0000-0000-0000-00000000000a'::uuid, 'b0000000-0000-0000-0000-00000000000b'::uuid)
  ) is not null,
  'block_user sonrası eşleşme unmatched olarak işaretleniyor'
);

SELECT * FROM finish();
ROLLBACK;
