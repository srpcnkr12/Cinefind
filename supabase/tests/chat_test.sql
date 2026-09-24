BEGIN;
SELECT plan(11);

-- ============================================================================
-- Test kullanıcıları + doğrudan bir eşleşme/konuşma (swipe() akışı Faz 5'te
-- zaten test edildi; burada sohbete özgü mantığa odaklanılıyor).
-- ============================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-2222-3333-4444-555555555501', 'authenticated', 'authenticated', 'chat1@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-2222-3333-4444-555555555502', 'authenticated', 'authenticated', 'chat2@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-2222-3333-4444-555555555503', 'authenticated', 'authenticated', 'chat3@test.com', '', now(), now(), now(), '{}', '{}');

insert into matches (id, user_low, user_high)
values ('aaaaaaaa-0000-0000-0000-000000000001',
  '11111111-2222-3333-4444-555555555501', '11111111-2222-3333-4444-555555555502');

insert into conversations (id, match_id, kind, status)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'match', 'active');

insert into conversation_members (conversation_id, user_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-2222-3333-4444-555555555501'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-2222-3333-4444-555555555502');

-- ============================================================================
-- contains_scam_signal
-- ============================================================================
select ok(contains_scam_signal('beni 05551234567''den ara'), 'telefon numarası içeren mesaj işaretleniyor');
select ok(contains_scam_signal('whatsapp''tan yazalım mı'), '"başka uygulamaya geç" kalıbı işaretleniyor');
select ok(not contains_scam_signal('bu filmi çok sevdim, sen izledin mi?'), 'sıradan bir mesaj işaretlenmiyor');

-- ============================================================================
-- send_message: üye olmayan gönderemez/okuyamaz
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-2222-3333-4444-555555555503","role":"authenticated"}';

select throws_ok(
  $$ select send_message('bbbbbbbb-0000-0000-0000-000000000001', 'text', 'merhaba') $$,
  'P0001', 'not_a_member',
  'konuşma üyesi olmayan mesaj gönderemiyor'
);

select is(
  (select count(*)::int from messages where conversation_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  0,
  'konuşma üyesi olmayan hiçbir mesajı okuyamıyor (RLS)'
);

reset role;

-- ============================================================================
-- send_message: üye gönderebilir, bildirim diğer üyeye düşer
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-2222-3333-4444-555555555501","role":"authenticated"}';
select send_message('bbbbbbbb-0000-0000-0000-000000000001', 'text', '05551234567''den ara beni');
reset role;

select is(
  (select count(*)::int from messages where conversation_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  1,
  'üye mesaj gönderebiliyor'
);

select ok(
  (select moderation_flag from messages where conversation_id = 'bbbbbbbb-0000-0000-0000-000000000001' limit 1),
  'ilk 5 mesajda dolandırıcılık kalıbı moderation_flag''i işaretliyor'
);

select is(
  (select count(*)::int from notifications where user_id = '11111111-2222-3333-4444-555555555502' and type = 'new_message'),
  1,
  'diğer üyeye new_message bildirimi düşüyor'
);

-- ============================================================================
-- mark_conversation_read: yalnızca kendi üyeliğini günceller
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-2222-3333-4444-555555555502","role":"authenticated"}';
select mark_conversation_read('bbbbbbbb-0000-0000-0000-000000000001');
reset role;

select ok(
  (select last_read_message_id from conversation_members
   where conversation_id = 'bbbbbbbb-0000-0000-0000-000000000001' and user_id = '11111111-2222-3333-4444-555555555502'
  ) is not null,
  'mark_conversation_read kendi last_read_message_id''ini güncelliyor'
);

select ok(
  (select last_read_message_id from conversation_members
   where conversation_id = 'bbbbbbbb-0000-0000-0000-000000000001' and user_id = '11111111-2222-3333-4444-555555555501'
  ) is null,
  'mark_conversation_read diğer üyenin durumunu değiştirmiyor'
);

-- ============================================================================
-- unmatch: her iki taraf için de konuşmayı kapatır
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-2222-3333-4444-555555555501","role":"authenticated"}';
select unmatch('aaaaaaaa-0000-0000-0000-000000000001');
reset role;

select is(
  (select status from conversations where match_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'closed',
  'unmatch sonrası konuşma her iki taraf için de kapanıyor'
);

SELECT * FROM finish();
ROLLBACK;
