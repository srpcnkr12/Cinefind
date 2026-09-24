# ADR 0003 — Font Türkçe Karakter Doğrulaması

- Durum: Kabul edildi
- Tarih: 2026-09-11

## Karar

PRD bölüm 15.3'teki fontlar onaylandı: başlık için **Big Shoulders Display**, gövde metni için **Hanken Grotesk** (ikisi de Google Fonts, `@expo-google-fonts/*` üzerinden mobilde, `next/font/google` üzerinden webde kullanılacak).

## Doğrulama

Google Fonts kaynak deposundaki (`google/fonts` GitHub, `ofl/bigshouldersdisplay` ve `ofl/hankengrotesk`) `METADATA.pb` dosyaları kontrol edildi:

- `bigshouldersdisplay`: `subsets: latin, latin-ext, menu, vietnamese`
- `hankengrotesk`: `subsets: cyrillic-ext, latin, latin-ext, menu, vietnamese`

Her iki fontta da **`latin-ext`** alt kümesi mevcut. Google Fonts'ta `latin-ext`, Türkçe için gerekli ğ, Ğ, ş, Ş, ı, İ, ö, Ö, ü, Ü karakterlerini kapsayan Latin Extended-A bloğunu içerir. Bu nedenle her iki font da Türkçe karakterleri doğru render edebilir.

## Sonuç

Font değişikliği gerekmedi. Uygulamada gerçek cihaz/simülatörde görsel doğrulama Faz 0 kabul kriterleri kapsamında ayrıca yapılacak (bkz. Faz 0 özeti).

## Ek not — web'de `next/font/google` sınırlaması (2026-09-11)

`next@16.3.4` paketinin `next/font/google` kataloğu (`font-data.json`) incelendiğinde **"Big Shoulders Display" ayrı bir aile olarak listelenmediği** görüldü (yalnızca `Big_Shoulders`, `Big_Shoulders_Inline`, `Big_Shoulders_Stencil` var; "Hanken Grotesk" ise mevcut). Bu nedenle:

- **Web** (`apps/web`): Big Shoulders Display, Google Fonts'un `google/fonts` deposundaki (OFL lisanslı) değişken (variable) TTF dosyası indirilip `apps/web/src/fonts/BigShouldersDisplay-Variable.ttf` olarak self-host edildi; `next/font/local` ile yüklenir. Hanken Grotesk `next/font/google` üzerinden yüklenir.
- **Mobil** (`apps/mobile`): `@expo-google-fonts/big-shoulders-display` paketi mevcut olduğu için değişiklik gerekmedi.
  Lisans dosyası `apps/web/src/fonts/BigShouldersDisplay-OFL.txt` olarak repoya eklendi.
