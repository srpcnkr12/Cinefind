# ADR 0002 — Açık Kararlar (PRD Bölüm 21) Çözümleri

- Durum: Kabul edildi (madde 1, 2026-10-07'de ADR-0022 ile geçersiz kılındı)
- Tarih: 2026-09-11

PRD bölüm 21'deki 12 açık karar için kullanıcıya soruldu. 4 tanesi doğrudan onaylandı; kalanı PRD'deki varsayılanla ilerliyor (kullanıcı tarafından reddedilmedi). Her biri geri alınabilir ve ileride revize edilebilir.

| #   | Karar                                       | Sonuç                                                                                                                                | Kaynak                          |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| 1   | Kalıcı ad/alan adı                          | **Reelmate** (placeholder) ile devam; marka tescil/alan adı araştırması ayrıca yapılmalı                                             | Kullanıcı onayı                 |
| 2   | Backend                                     | **Supabase**                                                                                                                         | Kullanıcı onayı (bkz. ADR-0001) |
| 3   | TMDB ticari lisans                          | Görüşme **başlamadı**; geliştirme TMDB developer key + fixture ile sürdürülür; **lansmandan önce ticari anlaşma zorunlu** (PRD 11.2) | Kullanıcı onayı                 |
| 4   | Lansman pazarları/dil sırası                | Türkiye (TR + EN)                                                                                                                    | PRD varsayılanı                 |
| 5   | Arkadaşlık ve film arkadaşı modu v1'de mi   | Evet                                                                                                                                 | PRD varsayılanı                 |
| 6   | Moderasyon sağlayıcısı                      | Arayüz (`ModerationProvider`) + mock; gerçek sağlayıcı sonra seçilir                                                                 | PRD varsayılanı                 |
| 7   | Attribution sağlayıcısı                     | Karar ertelendi; CTA bileşeni sağlayıcıdan bağımsız tasarlanır                                                                       | PRD varsayılanı                 |
| 8   | Ücretsiz günlük swipe / premium fiyat bandı | 25 swipe/gün; fiyatlar mağaza panellerinde (kodda sabit yok)                                                                         | PRD varsayılanı                 |
| 9   | Film asistanı adı/lansman zamanı            | **Mira**, v1.1'de                                                                                                                    | PRD varsayılanı                 |
| 10  | Gönderilerde görsel paylaşımı               | v1'de yok                                                                                                                            | PRD varsayılanı                 |
| 11  | Web gönderi görünürlüğü varsayılanı         | Kapalı (opt-in, `web_posts_public=false`)                                                                                            | PRD varsayılanı                 |
| 12  | Tasarım konsepti ("Gece seansı")            | Onaylandı, doğrudan uygulanacak                                                                                                      | Kullanıcı onayı                 |

## Not

Madde 3 (TMDB lisansı) yüksek risk taşıyor: ticari anlaşma olmadan lansman yapılamaz. Faz 10 (Lansman Hazırlığı) kabul kriterlerine bu kontrol eklenecek ve kullanıcıya lansmandan önce tekrar hatırlatılacak.
