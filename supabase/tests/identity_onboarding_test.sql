BEGIN;
SELECT plan(7);

-- ============================================================================
-- Test kullanıcıları (auth.users insert'i on_auth_user_created trigger'ını tetikler)
-- ============================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'user1@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'user2@test.com', '', now(), now(), now(), '{}', '{}');

-- Trigger tetiklendi mi? (birthdate='birthdate' onboarding_step ile otomatik profil)
select is(
  (select onboarding_step from profiles where id = '11111111-1111-1111-1111-111111111111'),
  'birthdate',
  'auth.users insert''i otomatik olarak onboarding_step=birthdate ile bir profil oluşturuyor'
);

-- ============================================================================
-- 18 yaş altı kayıt imkânsız
-- ============================================================================
select throws_ok(
  $$ update profiles set birthdate = (current_date - interval '17 years')::date where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514',
  null,
  '18 yaşından küçük bir doğum tarihi veritabanı seviyesinde reddediliyor'
);

select lives_ok(
  $$ update profiles set birthdate = (current_date - interval '20 years')::date where id = '11111111-1111-1111-1111-111111111111' $$,
  '18 yaş ve üzeri bir doğum tarihi kabul ediliyor'
);

-- ============================================================================
-- profile_photos: onaysız fotoğraf başka kullanıcıya hiçbir sorguda dönmez
-- ============================================================================
insert into profile_photos (user_id, storage_path, position, moderation_status)
values
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111/pending.jpg', 1, 'pending'),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111/approved.jpg', 2, 'approved');

set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from profile_photos where user_id = '11111111-1111-1111-1111-111111111111' and moderation_status = 'pending'),
  0,
  'onaysız (pending) fotoğraf başka bir kullanıcıya hiç dönmüyor'
);

select is(
  (select count(*)::int from profile_photos where user_id = '11111111-1111-1111-1111-111111111111' and moderation_status = 'approved'),
  1,
  'onaylı (approved) fotoğraf başka kullanıcıya görünüyor'
);

reset role;

-- ============================================================================
-- Rızalar sürümlü kaydediliyor (aynı türde iki farklı sürüm, ikisi de kalıcı)
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select record_consent('kvkk_notice', 'v1');
select record_consent('kvkk_notice', 'v2');
reset role;

select is(
  (select count(*)::int from consents where user_id = '11111111-1111-1111-1111-111111111111' and consent_type = 'kvkk_notice'),
  2,
  'aynı rıza türünün farklı sürümleri ayrı satırlar olarak (üzerine yazmadan) tutuluyor'
);

-- ============================================================================
-- Onboarding ilerlemesi `last_active_at` damgasını atıyor
-- ============================================================================
-- Regresyon koruması: bu alanı yalnızca testler ve seed betiği doldurduğu için
-- gerçek kullanıcılarda hep NULL kalıyordu ve `get_discovery_deck`'in
-- "son 30 günde aktif" filtresi onları kalıcı olarak eliyordu.
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update profiles set last_active_at = null where id = '11111111-1111-1111-1111-111111111111';
select update_onboarding_step('completed');
reset role;

select isnt(
  (select last_active_at from profiles where id = '11111111-1111-1111-1111-111111111111'),
  null,
  'update_onboarding_step last_active_at damgasını atıyor (keşfette görünürlük için şart)'
);

SELECT * FROM finish();
ROLLBACK;
