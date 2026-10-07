# ADR 0022 — Marka adı Movieholix olarak kesinleşti

- Durum: Kabul edildi
- Tarih: 2026-10-07
- Geçersiz kılar: ADR-0002 madde 1 (“Reelmate (placeholder)”)

## Bağlam

ADR-0002 madde 1, adı **Reelmate (placeholder)** olarak bırakmış ve marka
tescil/alan adı araştırmasını açık iş olarak işaretlemişti. Kullanıcı kalıcı adı
**Movieholix** olarak belirledi.

PRD bölüm 21 madde 1'in gerekçesi tam da buydu: ad tek bir yerden
(`packages/config/src/brand.ts` + `packages/i18n`) değiştirilebilir tutulmuştu.
Ancak paket scope'u, bundle identifier'lar ve depolama anahtarları bu merkezî
dosyanın dışındaydı; bu ADR onların da taşındığını kayda geçirir.

## Karar

Görünen ad **Movieholix**, tanımlayıcılarda **movieholix**.

| Alan                               | Eski                       | Yeni                               |
| ---------------------------------- | -------------------------- | ---------------------------------- |
| pnpm paket scope'u                 | `@reelmate/*`              | `@movieholix/*`                    |
| Kök paket adı                      | `reelmate`                 | `movieholix`                       |
| Supabase yerel proje               | `reelmate`                 | `movieholix`                       |
| Expo adı / slug / scheme           | `Reelmate` / `reelmate`    | `Movieholix` / `movieholix`        |
| iOS bundle id, Android package     | `app.reelmate.mobile`      | `app.movieholix.mobile`            |
| Alan adı                           | `reelmate.app`             | `movieholix.app`                   |
| Destek e-postası                   | `destek@reelmate.app`      | `destek@movieholix.app`            |
| Cloudflare tanıtım sitesi Worker'ı | —                          | `movieholix` (yeni, bkz. ADR-0021) |
| Web tema anahtarı                  | `reelmate-theme`           | `movieholix-theme`                 |
| Web sticky bar çerezi              | `reelmate-hide-sticky-bar` | `movieholix-hide-sticky-bar`       |
| Mobil mutation kuyruğu             | `reelmate.mutationQueue`   | `movieholix.mutationQueue`         |
| Demo tohum e-postaları             | `…@reelmate.demo`          | `…@movieholix.demo`                |

Türkçe i18n metinlerinde ek uyumu korundu: “Movieholix'i indir”,
“Movieholix'te kayıtlı”. (Reelmate son ünlüsü `e`, Movieholix son ünlüsü `i` —
ikisi de ince-düz olduğu için ek biçimleri aynı kaldı.)

## Bilinçli olarak değiştirilmeyenler

- **ADR-0002'nin karar tablosu.** Tarihsel kayıt; o tarihte alınan karar
  buydu. Yalnızca durum satırına “ADR-0022 ile geçersiz kılındı” notu düşüldü.
- **`film-tanisma-uygulamasi-claude-code-prompt.md`.** Projenin başlangıç
  girdi dokümanı, canlı yapılandırma değil — tarihsel olarak bırakıldı.

## Sonuçlar ve dikkat edilecekler

- **`movieholix.app` alan adının sahipliği doğrulanmadı.** Kodda artık bu alan
  adı var; kayıtlı değilse universal links, e-posta ve CTA'lar çalışmaz.
  ADR-0002'nin “marka tescil/alan adı araştırması” açık işi hâlâ açık.
- **Depolama anahtarları değişti.** `movieholix-theme`, sticky bar çerezi ve
  `movieholix.mutationQueue` eski anahtarları okumaz; mevcut cihazlarda tema
  tercihi sıfırlanır ve **kuyruktaki gönderilmemiş mutasyonlar düşer**.
  Uygulama yayınlanmadığı için etkisi yalnızca geliştirme cihazlarıyla sınırlı.
- **Bundle identifier değişti.** Yayınlanmamış bir uygulama için serbest; ilk
  mağaza yüklemesinden sonra bu ad kalıcı olur ve değiştirilemez.
- **Supabase `project_id` değişti.** Yerel Docker konteyner adları buna bağlı;
  `supabase stop` + `start` sonrası yeni konteyner kümesi oluşur ve yerel
  veritabanı boş gelir — `pnpm db:reset` + tohumlama gerekir.
