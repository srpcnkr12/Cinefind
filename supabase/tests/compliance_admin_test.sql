BEGIN;
SELECT plan(11);

-- ============================================================================
-- Test kullanıcıları: A (sıradan), M (moderatör), TARGET (moderasyon hedefi).
-- ============================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'comp-a@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'comp-m@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'comp-t@test.com', '', now(), now(), now(), '{}', '{}');

update profiles set
  birthdate = '1995-01-01', gender = 'woman', interested_in = array['man'], intents = array['dating'],
  discoverable = true, last_active_at = now(), age_min = 18, age_max = 60, max_distance_km = 100,
  onboarding_step = 'completed'
where id = 'c0000000-0000-0000-0000-00000000000c';

insert into admin_roles (user_id, role) values ('c0000000-0000-0000-0000-00000000000b', 'moderator');

insert into profile_locations (user_id, geog) values
  ('c0000000-0000-0000-0000-00000000000c', extensions.st_setsrid(extensions.st_makepoint(28.9800, 41.0090), 4326)::extensions.geography);
insert into profile_photos (user_id, storage_path, position, moderation_status) values
  ('c0000000-0000-0000-0000-00000000000c', 't/1.jpg', 1, 'approved');

-- ============================================================================
-- Admin RPC'leri: yetkisiz kullanıcı çağıramıyor.
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ select admin_list_reports() $$,
  'P0001', 'unauthorized',
  'admin olmayan kullanıcı admin_list_reports çağıramıyor'
);

select throws_ok(
  $$ select admin_moderate_user('c0000000-0000-0000-0000-00000000000c', 'ban') $$,
  'P0001', 'unauthorized',
  'admin olmayan kullanıcı admin_moderate_user çağıramıyor'
);
reset role;

-- ============================================================================
-- admin_moderate_user('ban') sonrası kullanıcı deste/akışta görünmüyor;
-- moderation_actions'a yazılıyor.
-- ============================================================================
update profiles set
  birthdate = '1993-01-01', gender = 'man', interested_in = array['woman'], intents = array['dating'],
  discoverable = true, last_active_at = now(), age_min = 18, age_max = 60, max_distance_km = 100,
  onboarding_step = 'completed'
where id = 'c0000000-0000-0000-0000-00000000000a';
insert into profile_locations (user_id, geog) values
  ('c0000000-0000-0000-0000-00000000000a', extensions.st_setsrid(extensions.st_makepoint(28.9784, 41.0082), 4326)::extensions.geography)
on conflict (user_id) do nothing;

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select admin_moderate_user('c0000000-0000-0000-0000-00000000000c', 'ban', 'test ban');
reset role;

select is(
  (select count(*)::int from moderation_actions where target_user_id = 'c0000000-0000-0000-0000-00000000000c' and action = 'ban'),
  1,
  'admin_moderate_user(ban) moderation_actions''a yazıyor'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select ok(
  not exists (select 1 from get_discovery_deck() where user_id = 'c0000000-0000-0000-0000-00000000000c'),
  'banlanan kullanıcı destede artık görünmüyor'
);
reset role;

-- ============================================================================
-- request_account_deletion: anında anonimleşiyor, deste/akışta görünmüyor.
-- ============================================================================
update profiles set banned_at = null where id = 'c0000000-0000-0000-0000-00000000000c';

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select request_account_deletion();
reset role;

select is(
  (select display_name from profiles where id = 'c0000000-0000-0000-0000-00000000000c'),
  'Silinmiş Kullanıcı',
  'request_account_deletion sonrası display_name anonimleşiyor'
);

select is(
  (select count(*)::int from profile_photos where user_id = 'c0000000-0000-0000-0000-00000000000c'),
  0,
  'request_account_deletion sonrası profil fotoğrafları siliniyor'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select ok(
  not exists (select 1 from get_discovery_deck() where user_id = 'c0000000-0000-0000-0000-00000000000c'),
  'silinmesi istenen kullanıcı destede artık görünmüyor'
);
reset role;

-- ============================================================================
-- check_rate_limit: eşik aşılınca rate_limited.
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select lives_ok(
  $$ select check_rate_limit('test_bucket', 2, 60) $$,
  'ilk çağrı limit altında başarılı'
);
select lives_ok(
  $$ select check_rate_limit('test_bucket', 2, 60) $$,
  'ikinci çağrı hâlâ limit altında başarılı'
);
select throws_ok(
  $$ select check_rate_limit('test_bucket', 2, 60) $$,
  'P0001', 'rate_limited',
  'üçüncü çağrı eşiği aşıyor ve reddediliyor'
);
reset role;

-- ============================================================================
-- revoke_consent: en güncel satır revoked olarak işaretleniyor.
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select record_consent('marketing', 'v1');
select revoke_consent('marketing');
reset role;

select ok(
  exists (
    select 1 from consents
    where user_id = 'c0000000-0000-0000-0000-00000000000a' and consent_type = 'marketing' and revoked_at is not null
  ),
  'revoke_consent sonrası revoked_at dolu bir satır ekleniyor'
);

SELECT * FROM finish();
ROLLBACK;
