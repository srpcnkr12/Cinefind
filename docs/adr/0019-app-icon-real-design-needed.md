# ADR 0019 — Uygulama İkonu/Splash Ekranı Bu Fazda Değiştirilmedi

- Durum: Kabul edildi
- Tarih: 2026-09-19

## Karar

`apps/mobile/assets/images/` altındaki ikon/splash dosyaları hâlâ Expo'nun varsayılan placeholder'ları (`react-logo`, `expo-logo` vb.) — Faz 10'da bunlara dokunulmadı.

## Gerekçe

Gerçek bir marka ikonu, PRD'nin kendi ilkesiyle tutarlı olarak (Bookspace'ten "görsel, logo veya marka öğesi kopyalanmaz" — bkz. CLAUDE.md) özgün bir tasarım gerektiriyor. Bu, yasal sayfalardaki "hukuki inceleme bekliyor" (Faz 2) ve TMDB/RevenueCat/Apple-Google OAuth'taki "gerçek hesap gerekiyor" emsalleriyle aynı kategoride: profesyonel bir tasarımcının işi, mühendislik kod tabanının değil. Rastgele bir yer tutucu ikon üretmek (ör. programatik bir SVG) gerçek bir marka kararını taklit eder ve daha sonra atılacak bir iş üretir — bu yüzden hiç yapılmadı.

## Sonuç

Gerçek marka ikonu/splash tasarımı hazır olduğunda `apps/mobile/assets/images/icon.png`, `android-icon-*.png`, `splash-icon.png`, `favicon.png` ve `apps/mobile/assets/expo.icon/` değiştirilecek; `app.json`'daki referanslar zaten doğru dosya adlarını gösteriyor, başka bir kod değişikliği gerekmeyecek.
