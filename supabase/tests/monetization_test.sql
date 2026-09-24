BEGIN;
SELECT plan(11);

-- ============================================================================
-- Test kullanıcıları: A (ücretsiz), B (premium, gelecekte biten entitlement),
-- C (süper mesajın alıcısı).
-- ============================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mon-a@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'mon-b@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'mon-c@test.com', '', now(), now(), now(), '{}', '{}');

update profiles set onboarding_step = 'completed', discoverable = true, last_active_at = now()
where id in ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000003');

insert into entitlements (user_id, entitlement, expires_at, store, product_id)
values ('b1000000-0000-0000-0000-000000000002', 'premium', now() + interval '7 days', 'app_store', 'premium_monthly');

-- ============================================================================
-- is_premium
-- ============================================================================
select ok(
  is_premium('b1000000-0000-0000-0000-000000000002'),
  'gelecekte biten entitlement''ı olan kullanıcı premium sayılıyor'
);

select ok(
  not is_premium('a1000000-0000-0000-0000-000000000001'),
  'hiç entitlement''ı olmayan kullanıcı premium değil'
);

-- ============================================================================
-- apply_revenuecat_event: aynı event.id iki kez gelince bakiye iki kez artmıyor
-- (Faz 8 kabul kriteri).
-- ============================================================================
select apply_revenuecat_event(
  'evt_boost_1', 'NON_RENEWING_PURCHASE', 'a1000000-0000-0000-0000-000000000001'::uuid,
  'boost_3', null, 'APP_STORE', 'txn_boost_1'
);
select apply_revenuecat_event(
  'evt_boost_1', 'NON_RENEWING_PURCHASE', 'a1000000-0000-0000-0000-000000000001'::uuid,
  'boost_3', null, 'APP_STORE', 'txn_boost_1'
);

select is(
  (select boosts from consumable_balances where user_id = 'a1000000-0000-0000-0000-000000000001'),
  3,
  'aynı event.id iki kez işlenince bakiye yalnızca bir kez (3) artıyor'
);

-- ============================================================================
-- apply_revenuecat_event: abonelik satın alma → is_premium true, sonra
-- geçmiş bir expiration_at_ms ile EXPIRATION → is_premium false (kabul kriteri).
-- ============================================================================
select apply_revenuecat_event(
  'evt_sub_1', 'INITIAL_PURCHASE', 'a1000000-0000-0000-0000-000000000001'::uuid,
  'premium_monthly', (extract(epoch from now() + interval '30 days') * 1000)::bigint, 'APP_STORE', 'txn_sub_1'
);

select ok(
  is_premium('a1000000-0000-0000-0000-000000000001'),
  'INITIAL_PURCHASE olayı sonrası kullanıcı premium oluyor'
);

select apply_revenuecat_event(
  'evt_sub_2', 'EXPIRATION', 'a1000000-0000-0000-0000-000000000001'::uuid,
  'premium_monthly', (extract(epoch from now() - interval '1 day') * 1000)::bigint, 'APP_STORE', 'txn_sub_1'
);

select ok(
  not is_premium('a1000000-0000-0000-0000-000000000001'),
  'geçmiş expiration_at_ms ile EXPIRATION olayı sonrası kapılar tekrar kapanıyor'
);

-- ============================================================================
-- undo_last_swipe / use_boost: premium olmayan kullanıcı engelleniyor.
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select undo_last_swipe() $$,
  'P0001', 'premium_required',
  'premium olmayan kullanıcı geri al''ı çağıramıyor'
);
reset role;

-- Bu noktada A'nın 3 boost'u var (yukarıdaki idempotency testinden) — 0
-- bakiye senaryosunu test etmek için elle sıfırlanıyor.
update consumable_balances set boosts = 0 where user_id = 'a1000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select use_boost() $$,
  'P0001', 'no_boosts_available',
  'bakiyesi 0''a düşen kullanıcı tekrar Öne Çık kullanamıyor'
);
reset role;

update consumable_balances set boosts = 3 where user_id = 'a1000000-0000-0000-0000-000000000001';

-- ============================================================================
-- use_boost: bakiyesi olan kullanıcı başarıyla kullanabiliyor.
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select use_boost();
reset role;

select is(
  (select boosts from consumable_balances where user_id = 'a1000000-0000-0000-0000-000000000001'),
  2,
  'use_boost sonrası bakiye 3''ten 2''ye düşüyor'
);

select ok(
  exists (select 1 from active_boosts where user_id = 'a1000000-0000-0000-0000-000000000001' and ends_at > now()),
  'use_boost sonrası aktif bir boost satırı oluşuyor'
);

-- ============================================================================
-- send_super_message / respond_to_super_message
-- ============================================================================
insert into consumable_balances (user_id, super_messages) values ('a1000000-0000-0000-0000-000000000001', 1)
on conflict (user_id) do update set super_messages = 1;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select send_super_message('c1000000-0000-0000-0000-000000000003', 'Merhaba!');
reset role;

select throws_ok(
  $$ select respond_to_super_message(
    (select id from conversations where kind = 'super_message' order by created_at desc limit 1), true
  ) $$,
  'P0001', 'sender_cannot_respond',
  'süper mesajı gönderen kişi kendi mesajını kabul/red edemiyor'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';
select respond_to_super_message(
  (select id from conversations where kind = 'super_message' order by created_at desc limit 1), false
);
reset role;

select is(
  (select super_messages from consumable_balances where user_id = 'a1000000-0000-0000-0000-000000000001'),
  0,
  'reddedilen süper mesaj bakiyeyi iade etmiyor'
);

SELECT * FROM finish();
ROLLBACK;
