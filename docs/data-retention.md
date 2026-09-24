# Veri Saklama Politikası

PRD bölüm 14.3, Faz 9. **Bu doküman bir taslaktır ve KVKK/VERBİS'in yurt dışına aktarım ve özel nitelikli veri işleme kısımları için hukukçu onayı gerektirir** (PRD'nin kendi notuyla tutarlı — bkz. `docs/adr/0015`'in benzer "bu ekip içi/taslak" kapsamı).

## Veri kategorileri ve saklama süreleri

| Kategori                                            | Saklama süresi                                                     | Not                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Hesap silme sonrası kişisel veri (profil, fotoğraf) | Anında anonimleştirme + 30 gün içinde kalıcı silme                 | `request_account_deletion()` + `account-deletion` günlük cron (bkz. Faz 9)                                                    |
| Mesajlaşma içeriği                                  | Hesap aktif olduğu sürece                                          | Şikâyet edilen mesajların bağlamı (`reports.context_snapshot`) şikâyet kapatıldıktan sonra da moderasyon kaydı olarak tutulur |
| Konum (`profile_locations`)                         | Hesap aktif olduğu sürece, ~500m'ye yuvarlanmış + günlük jitter'lı | Ham/kesin konum hiç saklanmaz (PRD 14.2)                                                                                      |
| Rıza kayıtları (`consents`)                         | Süresiz (append-only denetim izi)                                  | KVKK md. 20 kapsamında rıza kanıtı olarak saklanır                                                                            |
| Moderasyon eylemleri (`moderation_actions`)         | Süresiz                                                            | Denetim/hesap verebilirlik gereksinimi                                                                                        |
| Analitik olayları                                   | Ayrı bir analitik sağlayıcı kurulana kadar N/A                     | Mesaj içeriği, fotoğraf, konum, cinsel yönelim verisi asla gönderilmez (PRD 14.3)                                             |
| Veri dışa aktarma dosyaları (`data-exports` bucket) | 7 gün (imzalı URL süresi)                                          | Süre dolunca dosya erişilemez hale gelir; bucket temizliği ayrı bir iş (bu fazda yapılmadı, düşük öncelik)                    |

## Yurt dışına aktarım / VERBİS

Bu proje yerel geliştirmede çalışıyor; production'da hangi Supabase bölgesinin (ör. AB) kullanılacağı ve VERBİS'e kayıt yükümlülüğü olup olmadığı **hukukçuyla değerlendirilmeli** (PRD 14.3'ün kendi notu). Bu doküman bu kararı içermez.

## Hesap silme mekaniği (özet, bkz. Faz 9 migration'ı)

1. Kullanıcı `request_account_deletion()` çağırır → `deletion_requested_at` set edilir, `display_name`/`bio`/`username` temizlenir, `discoverable=false`, profil fotoğrafları hemen silinir. Kullanıcı bu andan itibaren hiçbir yüzeyde (deste, akış, arama, beğenenler) görünmez.
2. `account-deletion` günlük cron'u, `deletion_requested_at` 30 günü geçmiş hesapları `auth.admin.deleteUser()` ile kalıcı siler — FK `on delete cascade` tüm ilişkili satırları (mesajlar, gönderiler, eşleşmeler, rızalar vb.) temizler.
