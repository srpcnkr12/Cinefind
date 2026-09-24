# ADR 0016 — Veri Dışa Aktarma Uygulama İçi İmzalı Bağlantıyla Teslim Edilir

- Durum: Kabul edildi
- Tarih: 2026-09-18

## Karar

PRD 10.2 `data-export`'u "JSON + fotoğraflar ZIP, süreli imzalı link e-posta" olarak tanımlıyor. Bu ortamda:

- **E-posta yerine uygulama içi link:** Hiçbir e-posta sağlayıcısı (`RESEND_API_KEY`) hiç kurulmadı/kullanılmadı. `data-export` Edge Function dosyayı `data-exports` private Storage bucket'ına yükler, 7 günlük imzalı bir URL üretir, `data_export_requests` tablosuna yazar; mobil `settings/export-data` ekranı bu durumu sorgulayıp linki doğrudan gösterir.
- **Tek ZIP yerine JSON + ayrı fotoğraf dosyaları:** Deno için stabil/resmi bir ZIP kütüphanesi bu oturumda doğrulanamadı. Tüm yapılandırılmış veri tek bir `export.json`'a, onaylı fotoğraflar aynı klasöre ayrı dosyalar olarak yüklenir.

## Gerekçe

Gerçek kabul kriteri ("dışa aktarma dosyası kullanıcının tüm verisini içeriyor") tamamen test edilebilir kalıyor — gerçek bir kullanıcı için gerçek dosya üretilip indirilerek doğrulandı (bkz. Faz 9 raporu). Yalnızca teslimat kanalı (e-posta) ve paketleme biçimi (tek ZIP) basitleştirildi; RevenueCat/TMDB/Apple-Google OAuth'ta olduğu gibi bu ortamın kısıtı dürüstçe bayraklanıyor.

## Sonuç

Gerçek bir Resend hesabı/domaini sağlandığında, `data-export` fonksiyonu dosya hazır olduğunda kullanıcıya e-posta göndermek üzere genişletilebilir; `data_export_requests.status='done'` olduğunda tetiklenecek bir adım eklemek yeterli, şema değişmez.
