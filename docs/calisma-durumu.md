# Çalışma Durumu

Oturumlar arası devralma notu. Depoda olmayan ama tekrar keşfetmesi zaman alan
işletim bilgisi burada. **Son güncelleme: 2026-10-09.**

Karar gerekçeleri için `docs/adr/`, ürün kapsamı için `docs/PRD.md`.

## Ortam: neyin çalıştığı

|                                 | Durum                                                       |
| ------------------------------- | ----------------------------------------------------------- |
| **Android derleme**             | ✅ Çalışıyor — Expo SDK 57, Xcode gerekmiyor                |
| **iOS derleme**                 | ❌ Engelli — Xcode 26.3 + Expo SDK 57 uyumsuz               |
| Web (`apps/web`)                | ✅ Çalışıyor ama öncelik değil (mobil odaklı karar)         |
| Tanıtım sitesi (`apps/landing`) | ✅ Hazır, dağıtılmadı (`wrangler login` gerekiyor)          |
| Supabase bulut                  | ✅ `fwcexljyiyrwkbatbvmx` — şema, 9 edge function, 207 film |

### iOS engeli ve çözümü

`expo-modules-jsi`, Xcode 26.0–26.3 (Swift 6.2) ile derlenmiyor
(`RuntimeScheduler.h` SWIFT_RETURNS_RETAINED hatası, arkasında Swift 6
concurrency hataları). Expo'nun bilinen hatası; düzeltme
`expo-modules-jsi@58.0.9`'da.

İki çıkış yolu:

1. **macOS Tahoe 26.7.1 + Xcode 26.6** — installer `/Applications/Install macOS
Tahoe.app`'te indirilmiş durumda, kurulum bekliyor. SDK 57'de kalınır.
   (Xcode 26.6 macOS 26.2+ istiyor; macOS 27'ye çıkmaya gerek yok.)
2. **Expo SDK 58** — beta. Denendi, derleme geçti ama React Native 0.88 RC
   getiriyor ve 4 typecheck hatası çıkarıyor. `chore/expo-sdk-58` dalında
   stash'te duruyor. GA çıkınca rebase edilebilir.

## Yerel geliştirme: tuzaklar

**Android emülatöründe Supabase'e ulaşmak.** Emülatörde `127.0.0.1` emülatörün
kendisi demek; uygulama açılışta oturum kontrolünde takılır ve ekran siyah
kalır. Köprü şart:

    adb reverse tcp:8081 tcp:8081      # Metro
    adb reverse tcp:55321 tcp:55321    # Supabase

**Metro portu.** Debug derlemesi 8081'i gömüyor. Başka portta Metro
çalıştırırsan uygulama "No script URL provided" der.

**Android ortam değişkenleri** (kabukta tanımlı değil):

    export ANDROID_HOME=~/Library/Android/sdk
    export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
    export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

Sistem Java'sı 11; RN 17+ istiyor, Android Studio'nun JDK 21'i kullanılmalı.

**`expo prebuild` `package.json`'ı değiştiriyor** — `ios`/`android` script'lerini
`expo start --ios` yerine `expo run:ios` yapıyor. Prebuild sonrası geri al.
`ios/` ve `android/` gitignore'da, tek komutla yeniden üretilir.

**Yeni ekran eklerken.** `typedRoutes: true` açık; yeni rota eklenince
`expo start` bir kez çalıştırılmadan typecheck "not assignable to parameter of
type RelativePathString" hatası verir.

## Demo hesapla giriş (yerel)

Giriş e-posta OTP ile; kod yerel Mailpit'e (`:55324`) düşer.

1. `pnpm db:seed:demo` — `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` gerekir
   (`supabase status -o env` çıktısından)
2. E-posta: `demo-<küme>-<n>@movieholix.demo`, ör. `demo-bilimkurgu-1@…`
3. Kodu al: `curl -s "http://127.0.0.1:55324/api/v1/messages?limit=1"` → mesaj
   id'si → `/api/v1/message/<id>` içinde 6 haneli kod

Katalog boşsa önce `tmdb-sync` tetiklenmeli — **`apikey` başlığıyla**, `Authorization`
kabul edilmiyor:

    curl -X POST "$API_URL/functions/v1/tmdb-sync" -H "apikey: <secret key>"

Gerçek TMDB modunda senkron tek seferde bitmeyebilir (edge runtime limiti);
idempotent, tekrar çalıştır.

## git push takılıyorsa

`osxkeychain` yardımcısı arka plan bağlamında görünmez bir onay bekleyip
asılıyor. Depo-yerel olarak `gh`'nin token'ına geçirildi
(`credential.helper` = boş + `!gh auth git-credential`). Sorun yaşarsan:

    git config --local --get-all credential.helper

## Açık işler

**Mobil (PRD'ye göre eksik):**

- Sohbet ekranı, PRD 5.3'ün iki maddesini karşılamıyor: üst şerit (ortak
  filmler) ve "film ekle" düğmesi — `messages.kind` veritabanında `film_card`'ı
  zaten destekliyor
- PRD 5.2'de olup yazılmamış: `collection/[slug]`, `settings/{account,
discovery,privacy,language}`
- Maestro E2E akışları (PRD 18.1) hiç yazılmadı

**Hesap/kurulum bekleyenler:**

- Expo/EAS → Android imza anahtarı → `assetlinks.json`'daki SHA256 yer tutucusu
- Apple Developer → Team ID → `apple-app-site-association`; ayrıca Apple/Google
  girişinin gerçek sağlayıcı yapılandırması
- Sentry + PostHog (ADR-0018), RevenueCat (ADR-0014 mock)
- `movieholix.app` alan adı kayıtlı değil
- TMDB ticari lisansı (ADR-0002 madde 3) — lansman öncesi zorunlu

**Bilinen riskler:**

- `tmdb-sync` cron'u prod'da edge runtime limitine takılabilir; TTL düzeltmesi
  ilerlemeyi kalıcı kılıyor ama tek çalıştırmada bitmeyebilir
- Gerçek TMDB modunda koleksiyonlar editoryal; `refresh_curated_collections()`
  kural tabanlı bir başlangıç, gerçek küratörlük değil
