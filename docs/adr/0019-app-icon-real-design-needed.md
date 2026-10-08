# ADR 0019 — Uygulama İkonu/Splash Ekranı Bu Fazda Değiştirilmedi

- Durum: Kısmen çözüldü (2026-10-08, bkz. aşağıdaki güncelleme)
- Tarih: 2026-09-19

## Karar

`apps/mobile/assets/images/` altındaki ikon/splash dosyaları hâlâ Expo'nun varsayılan placeholder'ları (`react-logo`, `expo-logo` vb.) — Faz 10'da bunlara dokunulmadı.

## Gerekçe

Gerçek bir marka ikonu, PRD'nin kendi ilkesiyle tutarlı olarak (Bookspace'ten "görsel, logo veya marka öğesi kopyalanmaz" — bkz. CLAUDE.md) özgün bir tasarım gerektiriyor. Bu, yasal sayfalardaki "hukuki inceleme bekliyor" (Faz 2) ve TMDB/RevenueCat/Apple-Google OAuth'taki "gerçek hesap gerekiyor" emsalleriyle aynı kategoride: profesyonel bir tasarımcının işi, mühendislik kod tabanının değil. Rastgele bir yer tutucu ikon üretmek (ör. programatik bir SVG) gerçek bir marka kararını taklit eder ve daha sonra atılacak bir iş üretir — bu yüzden hiç yapılmadı.

## Sonuç

Gerçek marka ikonu/splash tasarımı hazır olduğunda `apps/mobile/assets/images/icon.png`, `android-icon-*.png`, `splash-icon.png`, `favicon.png` ve `apps/mobile/assets/expo.icon/` değiştirilecek; `app.json`'daki referanslar zaten doğru dosya adlarını gösteriyor, başka bir kod değişikliği gerekmeyecek.

## Güncelleme (2026-10-08)

Bu ADR, programatik bir yer tutucu ikon üretmeyi bilinçli olarak reddediyordu:
"gerçek bir marka kararını taklit eder ve daha sonra atılacak bir iş üretir".
Gerekçe o tarihte doğruydu — ortada bir marka işareti yoktu.

Sonrasında iki şey değişti: ad Movieholix olarak kesinleşti (ADR-0022) ve
tanıtım sitesi için bir marka işareti üretilip yayına girdi (ADR-0021) —
koyu zemin, sarı halka, pembe merkez noktası. Artık var olan bir işareti
uygulamaya taşımak rastgele bir yer tutucu değil, tutarlılık.

Kullanıcı onayıyla ikonlar o işaretten üretildi:
`icon.png`, `android-icon-{background,foreground,monochrome}.png`,
`splash-icon.png`, `favicon.png`. Oranlar tanıtım sayfasındaki SVG'den birebir
korundu (halka/nokta = 3.75, çizgi = halka yarıçapının 1/3'ü); renkler
`packages/tokens/src/raw.cjs`'ten geliyor, elle renk yazılmadı (CLAUDE.md
kuralı 11).

Üretim `apps/mobile/scripts/generate-icons.py` ile tekrarlanabilir; işaret
değişirse ikonlar tek komutla yeniden üretilir.

**Hâlâ açık:** bu mühendislikle üretilmiş tutarlı bir işaret, profesyonel bir
marka kimliği değil. İşaret sade (halka + nokta) ve ayırt ediciliği sınırlı.
Tasarımcı çalışması geldiğinde aynı dosyalar değiştirilecek; `app.json`
referansları doğru, başka kod değişikliği gerekmeyecek.

`apps/mobile/assets/expo.icon/` (Expo'nun katmanlı iOS ikon formatı) hâlâ
varsayılan Expo sembolünü içeriyor — `app.json` `ios.icon` olarak onu
gösteriyor, yani iOS'ta bu dosya `icon.png`'nin önüne geçer. Tasarım
çalışmasıyla birlikte ele alınmalı.
