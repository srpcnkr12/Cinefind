# Olay Taksonomisi

PRD bölüm 17.1. Tüm olay adları/özellik şekilleri `packages/core/src/domain/analytics.ts`'te TypeScript ile sabitlenir — bir olayın özelliklerine mesaj içeriği, kesin konum veya cinsel yönelim alanı eklemek derleme zamanında imkânsızdır (PRD 17.1'in "olay özelliklerinde... yok" kısıtı).

`trackEvent(name, properties)` çağrıldığında, kayıtlı bir `AnalyticsSink` yoksa (PostHog anahtarı ayarlanmadıysa) sessizce hiçbir şey yapmaz — bkz. `docs/adr/0018-no-real-analytics-crash-dashboards.md`.

## Nerede tetikleniyor

| Olay                                     | Tetiklendiği yer                                                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app_opened`                             | `apps/mobile/src/app/_layout.tsx` (fontlar yüklenince)                                                                                                                               |
| `signup_started`                         | Henüz bağlanmadı — (auth) akışının başlangıcında ayrı bir ekran/adım yok, `signup_completed` ile aynı `completeStep` çağrısına denk düşüyor                                          |
| `signup_completed`                       | `apps/mobile/src/lib/onboarding.ts` `completeStep("completed")`                                                                                                                      |
| `onboarding_step_completed`              | `apps/mobile/src/lib/onboarding.ts` `completeStep()` (her adım)                                                                                                                      |
| `taste_test_completed`                   | `apps/mobile/src/app/(onboarding)/taste-test.tsx` `finish()`                                                                                                                         |
| `top_four_set`                           | `apps/mobile/src/app/(onboarding)/top-four.tsx` `onContinue()`                                                                                                                       |
| `film_status_changed`, `film_rated`      | `apps/mobile/src/lib/mutation-queue.ts` (`upsert_user_film` başarılı olunca — hem anında hem çevrimdışı kuyruk sonrası)                                                              |
| `diary_entry_created`                    | `apps/mobile/src/lib/mutation-queue.ts` (`add_diary_entry`)                                                                                                                          |
| `line_created`                           | `apps/mobile/src/lib/mutation-queue.ts` (`add_film_line`)                                                                                                                            |
| `discover_card_viewed`                   | `apps/mobile/src/app/(tabs)/discover/index.tsx` (üstteki kart değişince)                                                                                                             |
| `swipe`, `match_created`                 | `packages/api/src/discovery.ts` `swipe()`                                                                                                                                            |
| `swipe_limit_reached`                    | `apps/mobile/src/app/(tabs)/discover/index.tsx` (limit hatası yakalanınca)                                                                                                           |
| `icebreaker_used`                        | **Bağlanmadı** — sohbet ekranında icebreaker önerisine dokunma UI'ı var ama ayrı bir olay tetiklemiyor; küçük bir eksik, düşük öncelik.                                              |
| `message_sent`                           | `packages/api/src/chat.ts` `sendMessage()` — `isFirst` şu an her zaman `false`: bu bilgi ucuz şekilde elde edilemiyor (RPC toplam mesaj sayısını dönmüyor), bkz. Faz 10 raporu.      |
| `conversation_reached_10_messages`       | **Bağlanmadı** — aynı sebeple (mesaj sayısı istemciye dönmüyor).                                                                                                                     |
| `shared_watchlist_item_added`            | `packages/api/src/chat.ts` `addSharedWatchlistItem()`                                                                                                                                |
| `post_created`                           | `packages/api/src/social.ts` `createPost()`                                                                                                                                          |
| `post_liked`                             | `packages/api/src/social.ts` `togglePostLike()` (yalnızca beğenince, bırakınca değil)                                                                                                |
| `comment_created`                        | `packages/api/src/social.ts` `addComment()`                                                                                                                                          |
| `follow_requested`                       | `packages/api/src/social.ts` `requestFollow()`                                                                                                                                       |
| `paywall_viewed`                         | `apps/mobile/src/app/premium/paywall.tsx` (mount, `?trigger=` route parametresinden — `limit_reached`, `likes_you`, `weekly_stats_locked`, `no_boosts`, `no_super_messages`, `menu`) |
| `purchase_started`, `purchase_completed` | `apps/mobile/src/lib/purchases.ts` `MockPurchasesProvider.purchasePackage()`                                                                                                         |
| `boost_used`                             | `packages/api/src/monetization.ts` `activateBoost()`                                                                                                                                 |
| `super_message_sent`                     | `packages/api/src/monetization.ts` `sendSuperMessage()`                                                                                                                              |
| `report_submitted`                       | `packages/api/src/discovery.ts` `reportContent()`                                                                                                                                    |
| `user_blocked`                           | `packages/api/src/discovery.ts` `blockUser()`                                                                                                                                        |
| `assistant_message_sent`                 | **Bağlanmadı** — film asistanı Faz 11 (v1.1) kapsamında, henüz hiç ekranı/RPC'si yok.                                                                                                |
| `web_cta_clicked`                        | `apps/web/src/components/download-cta.tsx` (App Store/Google Play düğmeleri)                                                                                                         |

## Bilinçli olarak bağlanmamış üç olay

`icebreaker_used`, `conversation_reached_10_messages`, `assistant_message_sent` şemada tanımlı ama hiçbir çağrı sitesi yok — ikisi ucuz veri erişimi olmadığı için (mesaj sayısı), biri henüz var olmayan bir özellik (Faz 11) olduğu için. Gelecekte bu üçü eklenirken şemayı değiştirmeye gerek yok, yalnızca yeni `trackEvent(...)` çağrıları eklenecek.
