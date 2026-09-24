# ADR 0020 — Universal Links/App Links Yer Tutucu Kimliklerle Kuruldu

- Durum: Kabul edildi
- Tarih: 2026-09-19

## Karar

`apps/web/src/app/.well-known/apple-app-site-association/route.ts` ve `.../assetlinks.json/route.ts` doğru `Content-Type` ile serve ediliyor, ama içerikleri yer tutucu: Apple Team ID (`TEAMID.app.reelmate.mobile`) ve Android SHA256 imza parmak izi (`TODO_REPLACE_WITH_REAL_SHA256_FINGERPRINT`) gerçek değil. `apps/mobile/app.json`'a eklenen `ios.associatedDomains`/`android.intentFilters` de aynı yer tutucu domain'i kullanıyor.

## Gerekçe

Bu kimlikler yalnızca gerçek bir Apple Developer Program üyeliği (Team ID) ve gerçek bir imzalama anahtarıyla (Google Play App Signing veya yerel keystore) üretilebilir — bu ortamda hiçbiri yok. Dosyaların kendisi (doğru yol, doğru `Content-Type`, doğru JSON şekli) gerçek ve test edildi; yalnızca içerik gerçek hesaplar açıldığında doldurulacak.

## Sonuç

Gerçek Apple Developer/Google Play hesapları açıldığında: (1) `apple-app-site-association`'daki `TEAMID` gerçek Team ID ile değiştirilir, (2) `assetlinks.json`'daki SHA256 gerçek imzalama sertifikasının parmak iziyle değiştirilir, (3) `app.json`'daki placeholder domain gerçek üretim domainiyle değiştirilir. Kod/route yapısı değişmez.
