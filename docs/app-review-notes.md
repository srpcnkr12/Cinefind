# App Store / Google Play İnceleme Notları (Taslak)

PRD 14.4, Faz 10. **Bu doküman bir hazırlık taslağıdır** — gerçek bir App Store Connect/Google Play Console hesabı bu ortamda yok; aşağıdaki adımlar gerçek bir hesap açıldığında izlenecek yol haritasıdır.

## Demo hesap

`pnpm db:seed:demo` (bkz. `supabase/seed/demo-users.mjs`) yerel/staging ortamda 60 demo kullanıcı + 5 hazır eşleşme (aktif konuşmalı) oluşturur. İnceleme ekibine verilecek demo hesap:

- E-posta deseni: `demo-<küme>-<n>@movieholix.demo` (ör. `demo-bilimkurgu-1@movieholix.demo`)
- Bu kullanıcılardan biri incelemeye özel bir hesap olarak seçilip gerçek bir şifre/magic-link ile erişilebilir hale getirilmeli (staging ortamında, seed script'i çalıştırdıktan sonra `supabase.auth.admin.generateLink` ile).
- Demo hesabın profili dolu: görüntü adı, bio, 8 film (4'ü Kadraj'da), şehir, konum.
- En az bir aktif eşleşme + konuşma zaten var (seed script'in oluşturduğu 5 çiftten biri).

## İnceleme ekibine gösterilecek akış

1. Giriş → onboarding zaten tamamlanmış demo hesapla doğrudan Keşfet ekranına düşer.
2. Keşfet → diğer demo kullanıcılarla kaydırma (gerçek `get_discovery_deck()`).
3. Sohbetler → hazır eşleşme + mesaj geçmişi.
4. Sinematek → demo hesabın 8 filmi, günlüğü, replikleri.
5. Akış → demo kullanıcıların gönderileri (not: seed script şu an gönderi oluşturmuyor — bu bir sonraki iyileştirme, Faz 10 kapsamı dışında bırakıldı çünkü App Review'in temel akışı için zorunlu değil).
6. Paywall → `/premium/paywall`, mock satın alma (gerçek mağaza sandbox'ı olmadan test edilemez, bkz. ADR-0014).

## PRD 14.4 kontrol listesi durumu

| Madde                                                                     | Durum                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App Store 4.3 (farklılaşma: film günlüğü + sosyal akış)                   | ✅ Kod tarafı tamam (Sinematek, Akış) — mağaza açıklaması/ekran görüntüsü metni bu ortamda yazılamaz (gerçek mağaza paneli gerekir)                                                            |
| App Store 1.2 (içerik filtreleme, şikâyet, engelleme, iletişim bilgisi)   | ✅ Tamam (Faz 3/6/7/9)                                                                                                                                                                         |
| Hesap silme uygulama içinden + web bağlantısı                             | ✅ Tamam (Faz 9: `settings/delete-account`, `/[locale]/delete-account`)                                                                                                                        |
| Sign in with Apple (üçüncü taraf girişte)                                 | ⚠️ Bu projede yalnızca e-posta OTP var, üçüncü taraf sosyal giriş hiç eklenmedi — dolayısıyla bu madde uygulanamaz durumda (N/A), ama üçüncü taraf giriş eklenirse Apple girişi zorunlu olacak |
| Abonelik açıklamaları (fiyat/süre/otomatik yenileme/iptal) + geri yükleme | ✅ Tamam (Faz 8 paywall)                                                                                                                                                                       |
| İnceleme hesabı (dolu profil + eşleşmeye hazır test kullanıcıları)        | ✅ Kod/veri tarafı tamam (`db:seed:demo`) — gerçek App Store Connect/Google Play Console kaydına girilmesi bu ortamda yapılamaz                                                                |
| Yaş derecelendirmesi 18+                                                  | ⏳ Gerçek mağaza paneli ayarı, kod tarafında zaten 18 yaş altı kayıt engelli (`profiles_birthdate_18plus` kısıtı)                                                                              |

**Gerçek mağaza sandbox testi, gerçek ekran görüntüsü çekimi ve gerçek App Store Connect/Google Play Console kaydı bu ortamda yapılamaz** — bkz. ADR-0019 (uygulama ikonu), ADR-0020 (universal links). Bunlar dışında yukarıdaki listenin kod/veri tarafı tamamlanmıştır.
