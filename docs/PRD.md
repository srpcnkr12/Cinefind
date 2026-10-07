# Movieholix — Film Zevki Üzerinden Tanışma ve Sinefil Sosyal Uygulaması

## Claude Code için Ürün + Teknik Spesifikasyon (PRD & Build Prompt)

> **Çalışma adı:** Movieholix (placeholder). Marka adı, renkleri ve metinleri tek bir yerden (`packages/config/brand.ts` + `packages/i18n`) değiştirilebilir olmalı.
> **Referans ürün:** bookspace.co (kitapseverler için tanışma uygulaması). Bookspace yalnızca **ürün/iş modeli referansıdır**. Onlara ait hiçbir metin, görsel, logo, illüstrasyon, renk paleti veya marka öğesi kopyalanmayacak. Her şey özgün üretilecek.

---

## 0. Claude Code: Bu Dokümanı Nasıl Kullanacaksın

1. Bu dosyanın **tamamını** oku. Ardından repoda `docs/PRD.md` olarak sakla ve kök dizine bölüm 22'deki içerikle bir `CLAUDE.md` oluştur.
2. Kod yazmaya başlamadan önce **bölüm 21 "Açık Kararlar"** listesini bana sor. Cevap alamadığın maddelerde dokümandaki varsayılanla ilerle ve bunu `docs/adr/` altına karar kaydı (ADR) olarak yaz.
3. İşi **bölüm 19'daki fazlar sırasıyla** yap. Her fazın başında kısa bir uygulama planı çıkar ve onayımı al. Her fazın sonunda lint + typecheck + testleri çalıştır, kabul kriterlerini tek tek doğrula, yapılanları ve kalan işleri özetle.
4. Kütüphane sürümlerini, API imzalarını ve platform kurallarını **hafızandan değil güncel resmi dokümantasyondan** doğrula (Expo, Next.js, Supabase, RevenueCat, TMDB, Anthropic API, App Store / Google Play kuralları).
5. Belirsiz bir durumda tahmin yürütüp büyük bir yapı kurmak yerine dur ve sor. Küçük, geri alınabilir kararlar için makul varsayımla ilerle ve not düş.

---

## 1. Referans Analizi: Bookspace'ten Ne Öğrendik

### 1.1 Bookspace'in yapısı (gözlem)

- **Konumlandırma:** "Kitaplar üzerinden gerçek tanışma." Uygulama mağazada _Books_ kategorisinde; yani önce bir kitap takip + sosyal uygulaması gibi duruyor, tanışma bunun üstüne bir katman. Bu, niş dating uygulamaları için önemli bir strateji (bkz. 14.4 App Store 4.3).
- **3 adımlı döngü:** Kütüphaneye favori kitapları ekle → benzer zevkteki okurlarla eşleş → sohbet et.
- **Üç ana değer önerisi:** Kitap takibi (okuyorum / okudum / okumak istiyorum), zevk üzerinden eşleşme, alıntı paylaşılan sosyal akış (beğeni, yorum, repost, alıntılama, yer imi, @bahsetme).
- **Mobil uygulama özellikleri:** Swipe & match, günlük swipe limiti ve limit ekranında geri sayım, takip istekleri, alıntı/highlight kaydetme, AI öneri botu, haftalık istatistik (profilini kim görüntüledi, son 7 gün sıralaman), karanlık mod, TR/EN dil, 18+ yaş sınırı.
- **Gelir modeli:** Freemium. Premium (haftalık / aylık / yıllık abonelik) sınırsız swipe ve ekstra ayrıcalıklar veriyor. Ayrıca tüketilebilir paketler: Boost (1/3/5) ve Super Message (3/5/9, eşleşmeden mesaj atma).
- **Web sitesi = SEO + uygulama indirme hunisi.** Web'de giriş/hesap yok. Sayfalar:
  - Landing (hero, nasıl çalışır, neden seveceksin, kullanıcı hikâyeleri, SSS, indirme CTA'ları)
  - `/explore`: küratörlü koleksiyonlar, türler, yazarlar
  - `/books` katalog, `/books/[id]-[slug]` detay: künye, özgün uzun özet, topluluk gönderileri, alıntılar, "yazarın diğer kitapları"
  - `/authors/[slug]`: özgün biyografi + eserler
  - `/popular`, `/blog`, gizlilik/şartlar
  - Her sayfada "uygulamayı indir" CTA'sı, kitap sayfasında yapışkan alt bar ("Uygulamada oku"), attribution'lı deep link (kampanya/adgroup parametreleri), `en`/`tr` dil yolları.
- **Zayıf noktalar (bizim fırsatımız):** Katalogda aynı eserin onlarca baskısı ayrı sayfa olarak listeleniyor (ince/tekrarlı içerik). Popüler sayfası çok az öğe gösteriyor. Web'deki topluluk içeriği sınırlı. Kullanıcı hikâyeleri landing'de tekrar ediyor.

### 1.2 Kavram eşleme tablosu (kitap → film)

| Bookspace kavramı                    | Movieholix karşılığı                                                          | Not                                              |
| ------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| Kütüphane / kitaplık                 | **Sinematek** (kişisel film arşivi)                                           | Profilin kalbi                                   |
| Okuyorum / Okudum / Okumak istiyorum | **İzledim / İzleme listem** + **Film günlüğü** (tarihli kayıt, tekrar izleme) | Filmde "okuyorum" durumu anlamsız; yerine günlük |
| Favori kitaplar                      | **Kadrajım**: profilde sabit 4 favori film                                    | Profilin görsel imzası                           |
| Alıntı / highlight                   | **Replikler**: kullanıcının yazdığı kısa replikler ve sahne notları           | Toplu replik veritabanı çekilmez (telif)         |
| Yazar sayfası                        | **Yönetmen & oyuncu sayfaları**                                               | Özgün biyografi                                  |
| Koleksiyonlar                        | Küratörlü listeler (Yeşilçam klasikleri, dünya sineması vb.)                  | Yerel içerik avantajı                            |
| AI bot (Olivia)                      | **Film asistanı** (çalışma adı "Mira")                                        | Claude API                                       |
| Swipe limiti + geri sayım            | Aynı                                                                          | Remote config                                    |
| Boost / Super Message                | **Öne Çık** / **Süper Mesaj**                                                 | Tüketilebilir IAP                                |
| Haftalık istatistik                  | Aynı + "bu hafta en çok izlenen ortak filmler"                                |                                                  |
| Sosyal akış                          | Aynı + **spoiler koruması**                                                   |                                                  |
| Web SEO katalog                      | Film, kişi, koleksiyon, popüler, blog sayfaları                               | Tekrarlı sayfa yok (tek kanonik film kaydı)      |

---

## 2. Konumlandırma ve Farklılaşma

**Tek cümle:** Movieholix, izlediğin filmleri kaydettiğin bir sinema günlüğü; film zevki seninkiyle örtüşen insanlarla tanışmanı ve ilk sohbeti ortak bir filmden başlatmanı sağlar.

**Hedef kitle:** 20–40 yaş, düzenli film izleyen, Letterboxd/IMDb kullanan veya kullanmayı bırakmış, klasik dating uygulamalarının yüzeyselliğinden yorulmuş kişiler. İlk pazar Türkiye (TR/EN), sonra İngilizce konuşulan pazarlar.

**Kullanım niyetleri (profil başına çoklu seçilebilir):**

- Flört
- Arkadaşlık
- **Film arkadaşı** (sinemaya/festivale birlikte gidecek biri) → Bookspace'te olmayan, filme özgü güçlü bir mod

**Bookspace'in ötesine geçen, filme özgü özellikler:**

1. **Hızlı zevk testi (onboarding):** Farklı dönem, ülke ve türlerden ~30 filmlik bir kart destesi. Her kart için: "Sevdim / Fena değil / Sevmedim / İzlemedim". 2 dakikada anlamlı bir zevk profili çıkar (soğuk başlangıç sorununu çözer).
2. **Uyum yüzdesi ve "neden":** Her profil kartında uyum yüzdesi ve 1–3 somut sebep ("İkiniz de Aşk Zamanı'na 5 yıldız verdiniz", "Aynı yönetmeni seviyorsunuz").
3. **Hazır ilk mesaj (icebreaker):** Eşleşme anında ortak filmlerden türetilmiş 3 konuşma başlatıcı öneri.
4. **Ortak izleme listesi:** Eşleşen iki kişinin izleme listelerinin kesişimi + birlikte eklenen filmler.
5. **Film gecesi planla:** Ortak listeden film seç, "sinema / evde" seç; vizyondaki filmler (bölge: TR) ve dijital platform bilgisi gösterilir.
6. **Profil soruları (film odaklı):** "Altyazı mı dublaj mı?", "Jenerik sonu sahnesini bekler misin?", "Kimseye söyleyemediğin suçlu zevk filmin?", "Bir filmin içinde yaşayabilsen hangisi?"
7. **Spoiler koruması:** Gönderi, yorum ve replikler spoiler olarak işaretlenebilir; varsayılan bulanık.
8. **Sinema Karnesi (v1.1):** Yıllık/aylık paylaşılabilir istatistik görseli (Instagram story boyutu). Büyüme döngüsü.

---

## 3. Özellik Kapsamı

### 3.1 MVP (v1.0)

- Kimlik doğrulama: Apple, Google, e-posta OTP. 18+ doğum tarihi kontrolü.
- Profil: 2–6 fotoğraf, isim, yaş, cinsiyet, ilgi duyulan cinsiyet(ler), niyet, şehir, bio (≤500 karakter), en fazla 3 profil sorusu cevabı, Kadrajım (4 favori).
- Onboarding zevk testi (min. 10 puan **veya** 4 favori olmadan keşfet açılmaz).
- Sinematek: izledim / izleme listesi, 0.5–5 yıldız puan, beğeni, film günlüğü, replik kaydetme, kişisel istatistikler.
- Film arama (TR/EN başlıklar), film detay, kişi detay, koleksiyonlar, popüler.
- Keşfet: swipe destesi (beğen / geç / süper beğen), filtreler (yaş, mesafe, niyet), günlük limit + geri sayım, geri al (premium).
- Eşleşme anı, beğenenler listesi (ücretsizde bulanık).
- Sohbet: gerçek zamanlı mesaj, film kartı / replik kartı paylaşma, icebreaker önerileri, okundu bilgisi, push, eşleşmeyi kaldırma, şikâyet/engelle.
- Ortak izleme listesi.
- Sosyal akış: metin, inceleme (puanlı), replik, liste gönderileri; beğeni, yorum, repost, alıntılı paylaşım, yer imi, @bahsetme; takip + gizli hesapta takip isteği; spoiler.
- Bildirimler (uygulama içi + push).
- Premium abonelik, Öne Çık, Süper Mesaj, haftalık istatistik.
- Güvenlik: engelle, şikâyet, fotoğraf ve metin moderasyonu, admin şikâyet kuyruğu, hesap silme, veri dışa aktarma, KVKK/GDPR rıza yönetimi.
- Web sitesi (SEO + indirme hunisi), TR/EN.
- Karanlık/açık tema.

### 3.2 v1.1

- Film asistanı (AI) — altyapı MVP'de hazırlanabilir, lansman v1.1.
- Film gecesi planlayıcı (vizyon + platform bilgisi).
- Sinema Karnesi paylaşım görseli.
- Selfie doğrulama rozeti.
- Letterboxd CSV içe aktarma (kullanıcının kendi dışa aktardığı dosya).

### 3.3 v2 (kapsam dışı, veri modeli buna engel olmamalı)

- Diziler (`media_type` alanı şimdiden olsun).
- Etkinlikler (film gösterimi buluşmaları, festival modu).
- Görüntülü görüşme.
- Web'de giriş yapılan uygulama.

---

## 4. Temel Kullanıcı Akışları

**A. İlk açılış → keşfet**
Karşılama (3 kısa ekran) → Giriş (Apple/Google/e-posta) → Doğum tarihi (18 yaş altı ise nazik ret, hesap oluşturulmaz) → İsim, cinsiyet, ilgi → Niyet → Fotoğraflar → Konum izni (reddedilirse şehir seçimi) → **Zevk testi** → Kadrajım (4 favori, arama ile) → Profil soruları (atlanabilir) → Bildirim izni (değer anlatıldıktan sonra) → Keşfet.

**B. Eşleşme → ilk mesaj**
Karta sağa kaydır → karşı taraf daha önce beğendiyse eşleşme anı animasyonu → "Mesaj gönder" → sohbet ekranı üstte ortak filmler şeridi + 3 icebreaker önerisi → kullanıcı birine dokunur, düzenler, gönderir.

**C. Günlük döngü**
Film izledi → Sinematek'e ekle + puan + isteğe bağlı günlük notu → "Akışta paylaş?" önerisi → takipçiler ve o filmi seven eşleşmeler görür → yorum/sohbet.

**D. Limit dolunca**
Swipe limiti bitti ekranı: sonraki yenilemeye geri sayım + premium teklifi + "Bu arada Sinematek'ini güncelle" alternatif eylemi (zevk profilini zenginleştirir, eşleşme kalitesini artırır).

**E. Şikâyet**
Profil/mesaj/gönderi üç nokta menüsü → Şikâyet et → sebep seç → isteğe bağlı açıklama → otomatik engelleme önerisi → onay mesajı. Kullanıcı şikâyetin sonucunu bildirimde görür (detay vermeden).

---

## 5. Mobil Uygulama: Navigasyon ve Ekranlar

### 5.1 Alt sekme çubuğu (5 sekme)

1. **Keşfet** (swipe destesi)
2. **Akış** (sosyal)
3. **Sinematek** (film arşivim + arama)
4. **Sohbetler** (eşleşmeler + mesajlar + beğenenler)
5. **Profil**

Film asistanı: Sinematek ve film detay ekranından erişilen yüzen buton (v1.1).

### 5.2 Ekran listesi (expo-router rotaları)

```
app/
  (auth)/welcome, sign-in, verify-otp
  (onboarding)/birthdate, basics, intent, photos, location, taste-test, top-four, prompts, notifications
  (tabs)/
    discover/index            # swipe destesi
    discover/filters
    discover/limit-reached
    feed/index                # Takip edilenler | Keşfet sekmeleri
    feed/post/[id]
    feed/compose
    library/index             # İzledim | Listem | Günlük | Replikler | İstatistik
    library/search
    chats/index               # yeni eşleşmeler şeridi + konuşmalar
    chats/[conversationId]
    chats/likes               # beğenenler (premium)
    profile/index
  film/[id]                   # film detay (uygulama içi)
  person/[id]
  collection/[slug]
  user/[username]             # başka kullanıcının sosyal profili
  match/[matchId]             # eşleşme anı (modal)
  shared-watchlist/[matchId]
  premium/paywall
  premium/weekly-stats
  assistant/index             # v1.1
  settings/ (account, discovery, privacy, notifications, language, theme, blocked, consents, export-data, delete-account)
  report/[targetType]/[targetId]
```

### 5.3 Kritik ekranların detayı

**Keşfet kartı**

```
┌───────────────────────────────┐
│ ▬▬▬▬ ▭▭▭▭ ▭▭▭▭ ▭▭▭▭  (foto 1/4)│
│                               │
│          [ FOTOĞRAF ]         │
│                               │
│ Deniz, 27          3 km       │
│ %87 film uyumu  Flört, Film ark.│
├───────────────────────────────┤
│ Kadrajı   [afiş][afiş][afiş][afiş]
│ Neden: İkiniz de "Aşk Zamanı"na 5★
│ "Altyazı mı dublaj mı?"       │
│   Her zaman altyazı.          │
└───────────────────────────────┘
     (✕)       (★)        (♥)
```

- Kart aşağı kaydırılabilir: tüm fotoğraflar, bio, profil soruları, ortak filmler ızgarası, en sevdiği yönetmenler.
- Fotoğrafa dokununca sonraki foto. Afişe dokununca film önizleme sheet'i.
- Mesafe asla 1 km altı gösterilmez ("1 km'den yakın"); kova değerler kullanılır (bkz. 14.2).
- Hareket: sürükleme gesture'u Reanimated + Gesture Handler; beğen/geç yönünde renkli damga belirir. Haptik geri bildirim.

**Eşleşme anı (uygulamanın tek "gösterişli" anı)**

```
┌─────────────────────────┬─────────┐
│  Eşleştiniz              ┊  2 kişi │
│  Sen ve Deniz            ┊         │
│  Ortak favori:           ┊  ▣ ▣    │
│  [afiş] Aşk Zamanı       ┊         │
└─────────────────────────┴─────────┘
   [ Mesaj gönder ]   [ Kaydırmaya devam ]
```

- Sinema bileti metaforu: bilet kartı ekrana gelir, perforeli çizgiden koçanı yırtılır, iki profil fotoğrafı koçanın iki yanına oturur. Tek, orkestre edilmiş animasyon (~1.2 sn). `reduceMotion` açıksa sadece yumuşak geçiş.

**Sinematek**

- Üst: kullanıcı istatistik şeridi (bu yıl izlenen, ortalama puan, en çok izlenen tür).
- Segmentler: İzledim (ızgara afiş, puan rozeti), İzleme listem, Günlük (tarihe göre gruplu liste), Replikler, İstatistik (tür dağılımı, on yıllara göre, ülkelere göre, en çok izlenen yönetmenler).
- Hızlı ekleme: arama → sonuç satırında tek dokunuşla "İzledim" / "Listeye ekle"; uzun basınca puan çarkı.
- İyimser (optimistic) güncelleme + çevrimdışı kuyruk (TanStack Query persist + mutation queue).

**Film detay (uygulama)**

- Backdrop + afiş, başlık (yerel + orijinal), yıl, süre, tür, yönetmen, ülke.
- Eylemler: İzledim, Listeye ekle, Puan, Günlüğe ekle, Replik ekle, Akışta paylaş.
- "Bu filmi seven eşleşmelerin / takip ettiklerin" avatar şeridi.
- Özet, oyuncular (yatay liste), nerede izlenir (TR bölgesi, JustWatch atfı ile), topluluk gönderileri, replikler, benzer filmler.

**Sohbet**

- Üst şerit: ortak filmler (yatay afiş listesi) → dokununca film önizleme.
- Mesaj türleri: metin, film kartı, replik kartı, sistem mesajı ("Eşleştiniz"), icebreaker.
- Mesaj giriş alanında "film ekle" düğmesi → arama → kart olarak gönder.
- Boş sohbet durumunda 3 icebreaker önerisi (şablon tabanlı; v1.1'de AI destekli).
- Üç nokta: ortak liste, film gecesi planla (v1.1), eşleşmeyi kaldır, şikâyet et, engelle.

**Paywall**

- Karşılaştırmalı fayda listesi (ücretsiz vs premium), haftalık/aylık/yıllık seçenekler, fiyatlar **RevenueCat offerings'ten dinamik** gelir (kodda sabit fiyat yok), geri yükleme düğmesi, abonelik şartları ve otomatik yenileme bilgisi (mağaza kuralları gereği).

**Haftalık istatistik (premium, ücretsizde kısmi)**

- Son 7 günde profil görüntülenme sayısı, görüntüleyenler (premium), bölgedeki uyum sıralaması, en çok etkileşim alan gönderi, bu hafta en çok eşleşme getiren filmin.

---

## 6. Web Sitesi (SEO + İndirme Hunisi)

### 6.1 İlkeler

- Web'de **giriş yok**. Amaç: organik trafik (film/kişi/koleksiyon aramaları) → uygulama indirme.
- Next.js App Router, ISR/SSG, `next-intl`, yollar `/tr/...` ve `/en/...`, `hreflang` + `x-default`.
- Her sayfa: benzersiz title/description, canonical, Open Graph + Twitter kartı, JSON-LD (`Movie`, `Person`, `ItemList`, `BreadcrumbList`, `FAQPage`, `Organization`, `MobileApplication`), dinamik OG görseli (`next/og`).
- `sitemap.xml` (bölünmüş: films, people, collections, blog), `robots.txt`.
- Core Web Vitals hedefi: mobilde LCP < 2.5 sn, CLS < 0.1. Afişler `next/image` ile TMDB CDN'den (`remotePatterns`), boyutlu ve lazy.
- Tüm indirme bağlantıları attribution sağlayıcısı üzerinden (kampanya = `web`, adgroup = sayfa konumu: `hero`, `film_inline`, `film_bar`, `footer` vb.). Mobil tarayıcıda cihaza göre doğru mağaza; masaüstünde QR kod.

### 6.2 Sayfa haritası

| Rota                                                                       | İçerik                                                                     | Render                           |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------- |
| `/[locale]`                                                                | Landing                                                                    | SSG                              |
| `/[locale]/explore`                                                        | Koleksiyonlar, türler, yönetmenler, oyuncular sekmeleri + katalog kartları | ISR 1 gün                        |
| `/[locale]/explore/[slug]`                                                 | Koleksiyon / tür sayfası (film ızgarası + özgün giriş metni)               | ISR 1 gün                        |
| `/[locale]/films`                                                          | Katalog (topluluk ilgisine göre sıralı, sayfalı, tür/on yıl filtresi)      | ISR 6 saat                       |
| `/[locale]/films/[id]-[slug]`                                              | Film detay                                                                 | ISR 1 gün + on-demand revalidate |
| `/[locale]/people`                                                         | Kişi kataloğu (yönetmenler, oyuncular)                                     | ISR 1 gün                        |
| `/[locale]/people/[slug]`                                                  | Kişi detay                                                                 | ISR 1 gün                        |
| `/[locale]/popular`                                                        | Bu hafta toplulukta en çok izlenen/eklenen                                 | ISR 1 saat                       |
| `/[locale]/blog`, `/[locale]/blog/[slug]`                                  | MDX blog                                                                   | SSG                              |
| `/[locale]/stories`                                                        | Gerçek kullanıcı hikâyeleri (yazılı rıza ile)                              | SSG                              |
| `/[locale]/privacy`, `/terms`, `/kvkk`, `/community-guidelines`, `/safety` | Yasal ve güvenlik                                                          | SSG                              |
| `/[locale]/download`                                                       | Akıllı yönlendirme + QR                                                    | SSR                              |

### 6.3 Film detay sayfası yapısı

```
Ana sayfa / Filmler / Aşk Zamanı                         (breadcrumb)
┌────────┐  Dram, Romantik
│ AFİŞ   │  # Aşk Zamanı (In the Mood for Love)
│        │  Yönetmen: Wong Kar-wai
└────────┘  2000, 98 dk, Hong Kong, Kantonca
            [Uygulamada listene ekle]  [Paylaş]

## Film hakkında          (özgün, 2 paragraf editoryal özet)
## Toplulukta             Gönderiler (n)  Replikler (n)  Ortalama puan
   gönderi kartları (yalnızca web'de görünmeye izin veren kullanıcılar)
## Oyuncular ve ekip
## Nerede izlenir (TR)    (JustWatch atfı)
## Yönetmenin diğer filmleri
## Benzer filmler
## CTA bölümü: "Bu filmi seven biriyle tanış"   [App Store] [Google Play]
Alt yapışkan bar (mobil): "Sinematek'ine ekle — uygulamayı indir"  [×]
```

- Başlık tag'i kalıbı: `{Film Adı} ({Yıl}) — Özet, Replikler ve Yorumlar | Movieholix`
- Aynı film için tek kanonik sayfa. Slug Türkçe karakterlerden arındırılmış (ç→c, ğ→g, ı→i, İ→i, ö→o, ş→s, ü→u).
- Yetişkin içerikli (`adult=true`) filmler hiç indekslenmez ve katalogda yer almaz.

### 6.4 Landing sayfası (özgün metin taslağı — TR/EN)

**Hero**

- TR başlık: _Jenerikten sonra da konuşacak birini bul._
- TR alt metin: _İzlediğin filmleri kaydet, zevkin tutan insanlarla eşleş, ilk sohbeti ortak bir filmden başlat._
- EN başlık: _Find someone to talk to after the credits roll._
- EN alt metin: _Log the films you watch, match with people whose taste lines up with yours, and start with a film you both love._
- Görsel: telefon mockup'ında eşleşme bileti anı. CTA: mağaza rozetleri.

**Nasıl çalışır (gerçek bir sıra olduğu için numaralı)**

1. _İzlediklerini ekle_ — Sevdiklerin, listende bekleyenler, bir daha asla izlemeyeceklerin.
2. _Zevkin tutan insanlarla eşleş_ — Ortak favoriler ve puanlarınız üzerinden uyumunu gör.
3. _Ortak bir filmden başla_ — İlk mesaj için önerilerimiz hazır.

**Özellikler (3 blok, her biri telefon ekran görüntüsü ile)**

- _Film günlüğün_ — Ne zaman, nerede, kiminle izlediğini kaydet. Yılın sonunda kendi sinema karneni gör.
- _Replikler ve sahneler_ — Aklında kalan cümleyi yaz, aynı sahneyi sevenler seni bulsun.
- _Sinefil akışı_ — İncelemeler, listeler, tartışmalar. Spoiler'lar bulanık, sürprizler güvende.

**Kullanıcı hikâyeleri:** Lansmanda **boş bırakılır veya gizlenir**. Sahte yorum/testimonial yayınlanmaz (tüketici mevzuatı). Gerçek hikâyeler yazılı rıza ile `testimonials` tablosundan gelir.

**SSS:** Movieholix nedir? Ücretsiz mi? Kimlerle eşleşirim? Sadece flört için mi? (Hayır: arkadaşlık ve film arkadaşı modu) Film verileri nereden geliyor? Güvenliğim için ne yapıyorsunuz? Hangi platformlarda var?

**Footer:** Keşfet, Filmler, Kişiler, Popüler, Blog, öne çıkan koleksiyonlar, dil seçici, yasal bağlantılar, sosyal medya, **TMDB atfı ve logosu** (bkz. 11.3).

### 6.5 Başlangıç koleksiyonları (özgün küratörlük)

Yeşilçam Klasikleri, Yeni Türk Sineması, Dünya Sinemasından Başyapıtlar, İlk Randevu Filmleri, Birlikte Ağlanacak Filmler, Bilim Kurgu ve Fantastik, Gerilim ve Gizem, Modern Klasikler (2000 sonrası), Auteur Yönetmenler, Festival Favorileri, Belgeseller, Animasyon (yetişkinler için de).

---

## 7. Eşleşme ve Sıralama Algoritması

### 7.1 Zevk profili (kullanıcı başına, `packages/core/taste`)

```ts
type TasteProfile = {
  userId: string;
  topFour: FilmId[]; // Kadrajım
  liked: Set<FilmId>; // beğeni veya puan >= 4
  disliked: Set<FilmId>; // puan <= 2
  ratings: Map<FilmId, number>; // 0.5..5
  watched: Set<FilmId>;
  watchlist: Set<FilmId>;
  genreVector: Float32Array; // puan ağırlıklı, L2 normalize
  decadeVector: Float32Array; // 1920'ler..2020'ler
  countryVector: Float32Array; // ilk 30 ülke + "diğer"
  directorWeights: Map<PersonId, number>;
};
```

### 7.2 Film nadirlik ağırlığı (IDF)

Herkesin sevdiği bir gişe filmini paylaşmak, az bilinen bir filmi paylaşmaktan daha az sinyal taşır:

```
idf(f) = ln(1 + N_aktif_kullanıcı / (1 + f'yi izlemiş kullanıcı sayısı))
```

Günlük cron ile `film_stats.idf` olarak hesaplanır.

### 7.3 Bileşen skorları (0..1)

| Bileşen            | Hesap                                                                                                                     | Ağırlık |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------- |
| `favOverlap`       | (topFour ∪ liked) kümeleri üzerinde IDF ağırlıklı kosinüs                                                                 | 0.30    |
| `ratingAgreement`  | Ortak puanlanan filmlerde Pearson r; ortak film < 5 ise bileşen yok sayılır; küçültme: `r * n/(n+10)`; `(r+1)/2` ile 0..1 | 0.25    |
| `genreSim`         | genreVector kosinüs                                                                                                       | 0.15    |
| `directorSim`      | directorWeights ağırlıklı Jaccard                                                                                         | 0.10    |
| `watchlistOverlap` | İzleme listesi kesişimi (IDF ağırlıklı), min küme boyutuna göre normalize, 1'de kırpılır                                  | 0.10    |
| `eraCountrySim`    | decade + country vektör kosinüslerinin ortalaması                                                                         | 0.05    |
| `conflictPenalty`  | A'nın favorisi B'nin "sevmedim"i ise (ve tersi) film başına ceza, toplam en fazla −0.15                                   | ceza    |

```
raw = Σ(w_i * s_i) / Σ(w_i)   // yalnızca hesaplanabilen bileşenler üzerinden yeniden normalize
raw = clamp(raw - conflictPenalty, 0, 1)
```

### 7.4 Gösterilen uyum yüzdesi

- Ham skor saklanır, **kullanıcıya kalibre edilmiş değer** gösterilir: kullanıcının aday havuzundaki yüzdelik dilime göre 50–99 aralığına eşlenir. "%12 uyum" gibi sohbet öldüren değerler gösterilmez.
- Her eşleşme için `reasons` üretilir (en yüksek katkı yapan 1–3 somut sebep, film/yönetmen adıyla). Icebreaker'lar bu sebeplerden türetilir.

### 7.5 Keşfet destesi sıralaması

1. **Aday üretimi (SQL/RPC):** yaş aralığı (karşılıklı), cinsiyet tercihi (karşılıklı), niyet kesişimi, mesafe (PostGIS, karşılıklı), keşfedilebilir, son 30 günde aktif, daha önce kaydırılmamış, engelleme yok (iki yönlü), banlı değil, fotoğrafı onaylı. Üst sınır 500 aday.
2. **Skor:** `compatibility_scores` önbelleğinden; yoksa hesaplanıp yazılır.
3. **Nihai sıralama:**

```
final = 0.60*compat + 0.15*activityRecency + 0.10*profileQuality + 0.10*likedYouBoost + boostBonus
```

- `profileQuality`: fotoğraf sayısı, bio, soru cevapları, Sinematek büyüklüğü.
- `likedYouBoost`: seni beğenmiş biri desteye daha erken girer (ama hep ilk sırada değil).
- **Keşif:** destenin %10'u uyum eşiğini geçen rastgele adaylar.
- **Adillik:** bir profil günde en fazla X kez gösterilir (remote config), popüler profillerin tekelleşmesini engeller.

4. Deste 20'şer kart halinde sayfalanır.

### 7.6 Yeniden hesaplama

- `user_films` değişince kullanıcı `compat_recompute_queue`'ya eklenir (10 dk debounce).
- Gece cron: aktif kullanıcılar için tam yeniden hesap.
- Tüm skor fonksiyonları `packages/core` içinde **saf fonksiyonlar** olarak yazılır; Edge Function bunları import eder. Birim testleri + property-based testler (simetri, 0..1 aralığı, aynı profil = maksimum).

---

## 8. Teknik Mimari

### 8.1 Stack (varsayılan — Açık Kararlar'da onaylanacak)

| Katman                  | Seçim                                                                                                | Gerekçe                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Monorepo                | pnpm workspaces + Turborepo                                                                          | Mobil, web ve ortak paketler tek repoda        |
| Mobil                   | Expo (güncel SDK) + expo-router + TypeScript                                                         | iOS + Android tek kod tabanı, EAS Build/Update |
| Mobil UI                | NativeWind + `packages/tokens`, Reanimated, Gesture Handler, expo-image, FlashList                   | Performanslı liste ve swipe                    |
| Mobil durum             | TanStack Query (sunucu durumu), Zustand (yerel UI durumu)                                            |                                                |
| Web                     | Next.js (App Router) + next-intl + Tailwind CSS                                                      | SEO, ISR                                       |
| Backend                 | Supabase: Postgres (+ PostGIS, pg_cron, pgvector opsiyonel), Auth, Realtime, Storage, Edge Functions | Hızlı geliştirme, RLS ile güvenlik             |
| Doğrulama               | Zod (tüm sınırlarda), şemalar `packages/core`                                                        |                                                |
| Ödemeler                | RevenueCat (`react-native-purchases`) + webhook                                                      | Abonelik + tüketilebilir                       |
| Push                    | expo-notifications (APNs/FCM)                                                                        |                                                |
| AI                      | Anthropic Claude API (sunucu tarafı Edge Function)                                                   | Film asistanı, icebreaker                      |
| Film verisi             | TMDB API (lisans şartlarına tabi, bkz. 11)                                                           |                                                |
| Moderasyon              | Sağlayıcı arayüzü (`ModerationProvider`) — görsel ve metin                                           | Sağlayıcı değiştirilebilir                     |
| Analitik                | PostHog                                                                                              | Olay takibi, funnel, feature flag              |
| Hata izleme             | Sentry (mobil + web + edge)                                                                          |                                                |
| Attribution / deep link | Adjust, AppsFlyer veya Branch (Açık Karar)                                                           | Web → mağaza kampanya takibi                   |
| E-posta                 | Resend                                                                                               | OTP dışı işlem e-postaları                     |
| Test                    | Vitest, Playwright (web), Maestro (mobil E2E), pgTAP veya SQL testleri (RLS)                         |                                                |
| CI/CD                   | GitHub Actions, EAS Build, Vercel (web)                                                              |                                                |

### 8.2 Repo yapısı

```
movieholix/
├─ apps/
│  ├─ mobile/              # Expo uygulaması
│  ├─ web/                 # Next.js: pazarlama + SEO + /admin (rol korumalı route group)
├─ packages/
│  ├─ core/                # domain tipleri, zod şemaları, eşleşme algoritması (saf TS)
│  ├─ api/                 # tip güvenli Supabase istemci sarmalayıcıları + query key'leri + hook'lar
│  ├─ tokens/              # tasarım token'ları (renk, tipografi, boşluk, radius) → Tailwind & NativeWind preset
│  ├─ i18n/                # tr.json, en.json, yardımcılar (tr-TR büyük/küçük harf, slugify)
│  ├─ config/              # brand.ts, eslint, tsconfig, remote config varsayılanları
├─ supabase/
│  ├─ migrations/
│  ├─ functions/           # edge functions
│  ├─ tests/               # RLS ve RPC testleri
│  ├─ seed/                # yalnızca geliştirme: sahte kullanıcılar + film fixture'ları
├─ docs/
│  ├─ PRD.md, adr/, api.md, events.md, moderation-playbook.md
├─ CLAUDE.md
├─ .env.example
```

### 8.3 Mimari kurallar

- İstemciler (mobil/web) **asla** service role anahtarı görmez. Ayrıcalıklı işlemler Edge Function veya `SECURITY DEFINER` RPC ile yapılır.
- Her tabloda RLS açık; politika yazılmamış tablo migration'ı reddedilir (CI kontrolü).
- Sayaçlar (like_count vb.) trigger ile güncellenir; istemci sayaç yazamaz.
- Swipe, eşleşme oluşturma, limit düşme, tüketilebilir harcama gibi işlemler **tek transaction'lı RPC**'lerde ve idempotent.
- Tarih/saat UTC saklanır; günlük limit sıfırlama kullanıcının saat dilimine göre.
- Sunucu tarafı rate limit (Postgres tabanlı token bucket veya Upstash) — mesaj, gönderi, rapor, AI çağrıları için.

---

## 9. Veri Modeli (Postgres)

> Tüm `id` alanları `uuid` (varsayılan `gen_random_uuid()`), tüm tablolarda `created_at timestamptz default now()`. Kişisel veri içeren tablolarda `deleted_at` ile soft delete + zamanlanmış hard delete.

### 9.1 Kullanıcı ve profil

- **profiles**: `id` (= auth.users.id), `username` (unique, küçük harf), `display_name`, `birthdate` (date, CHECK 18+), `gender` (enum + `gender_custom`), `show_gender` bool, `interested_in` (gender[]), `intents` (enum[]: `dating`, `friendship`, `watch_buddy`), `bio` (≤500), `city`, `country_code`, `age_min`, `age_max`, `max_distance_km`, `locale`, `is_private` (sosyal profil), `discoverable` bool, `web_posts_public` bool (varsayılan false), `is_verified`, `verification_status`, `last_active_at`, `onboarding_step`, `deleted_at`.
- **profile_locations** (ayrı tablo, sadece RPC erişir): `user_id`, `geog geography(Point)`, `geohash5`, `updated_at`. İstemciye ham koordinat **asla** dönmez.
- **profile_photos**: `id`, `user_id`, `storage_path`, `position` (1..6), `blurhash`, `width`, `height`, `moderation_status` (`pending|approved|rejected`), `moderation_labels jsonb`.
- **profile_prompts**: `id`, `user_id`, `prompt_key`, `answer` (≤200), `position`.
- **consents**: `user_id`, `consent_type` (`kvkk_notice`, `special_category_data`, `location`, `marketing`, `analytics`), `version`, `granted_at`, `revoked_at`.
- **device_tokens**: `user_id`, `token`, `platform`, `last_seen_at`.

### 9.2 Film kataloğu

- **films**: `id`, `tmdb_id` (unique), `imdb_id`, `media_type` (`movie` şimdilik), `original_title`, `original_language`, `release_date`, `runtime`, `countries` (text[]), `poster_path`, `backdrop_path`, `tmdb_popularity`, `adult` bool, `slug`, `tmdb_synced_at`.
- **film_translations**: `film_id`, `locale`, `title`, `tagline`, `overview_source` (kaynaktan gelen özet), `editorial_overview` (özgün, editör onaylı), `seo_description`, PK(`film_id`,`locale`).
- **genres**, **genre_translations**, **film_genres**.
- **people**: `id`, `tmdb_id`, `name`, `slug`, `profile_path`, `known_for_department`, `birthday`, `deathday`, `place_of_birth`, `tmdb_popularity`.
- **person_translations**: `person_id`, `locale`, `editorial_bio`.
- **film_credits**: `film_id`, `person_id`, `role` (`director|writer|cast|cinematographer|composer|editor`), `character`, `billing_order`.
- **film_stats** (cron ile): `film_id`, `watched_count`, `watchlist_count`, `avg_rating`, `rating_count`, `weekly_adds`, `idf`.
- **collections**: `id`, `slug`, `kind` (`curated|genre|mood`), `is_published`, `sort_order`, `cover_film_ids uuid[]`.
- **collection_translations**: `title`, `intro` (özgün metin), `seo_description`.
- **collection_films**: `collection_id`, `film_id`, `position`, `note`.
- **watch_providers_cache**: `film_id`, `region`, `payload jsonb`, `fetched_at`.

### 9.3 Sinematek

- **user_films**: PK(`user_id`,`film_id`), `status` (`watched|watchlist|none`), `rating numeric(2,1)` (0.5 adımlı, null olabilir), `liked` bool, `top_four_position smallint` (1..4, unique per user), `first_watched_on date`, `watch_count int`, `updated_at`.
- **diary_entries**: `id`, `user_id`, `film_id`, `watched_on date`, `rating`, `is_rewatch`, `venue` (`cinema|home|festival|other`), `watched_with_user_id` (nullable), `note` (≤1000), `contains_spoiler`.
- **film_lines** (replikler): `id`, `user_id`, `film_id`, `text` (≤280), `character_name`, `contains_spoiler`, `moderation_status`.

### 9.4 Sosyal

- **posts**: `id`, `author_id`, `type` (`text|review|line|list|watched`), `film_id`, `line_id`, `list_id`, `body` (≤2000), `rating`, `contains_spoiler`, `repost_of_id`, `quote_of_id`, `visibility` (`public|followers`), `like_count`, `comment_count`, `repost_count`, `bookmark_count`, `moderation_status`, `deleted_at`.
- **user_lists** + **user_list_items**: kullanıcı film listeleri.
- **comments**: `id`, `post_id`, `author_id`, `parent_id`, `body` (≤1000), `contains_spoiler`, `like_count`, `moderation_status`, `deleted_at`.
- **post_likes**, **comment_likes**, **bookmarks**: PK(kullanıcı, hedef).
- **mentions**: `source_type` (`post|comment`), `source_id`, `mentioned_user_id`.
- **follows**: `follower_id`, `followee_id`, `status` (`pending|accepted`), PK ikisi.
- **public_web_posts** (VIEW): yalnızca `web_posts_public=true`, banlı olmayan, onaylı, spoiler'sız, `visibility=public` gönderiler; `username`, `display_name` ve yalnızca izin varsa avatar. Web sitesi sadece bu view'dan okur.

### 9.5 Eşleşme ve sohbet

- **swipes**: `swiper_id`, `target_id`, `action` (`like|pass|superlike`), `created_at`, UNIQUE(`swiper_id`,`target_id`), `undone_at`.
- **matches**: `id`, `user_low`, `user_high` (UNIQUE çift, `user_low < user_high`), `created_at`, `unmatched_at`, `unmatched_by`, `compat_raw`, `reasons jsonb`.
- **compatibility_scores**: `user_low`, `user_high`, `raw_score`, `components jsonb`, `reasons jsonb`, `computed_at`.
- **taste_vectors**: `user_id`, `genre_vector`, `decade_vector`, `country_vector`, `updated_at` (float4[] veya pgvector).
- **conversations**: `id`, `match_id` (nullable: süper mesaj ile başlayan), `kind` (`match|super_message`), `status` (`active|pending|closed`).
- **conversation_members**: `conversation_id`, `user_id`, `last_read_message_id`, `muted_until`.
- **messages**: `id`, `conversation_id`, `sender_id`, `kind` (`text|film_card|line_card|system|icebreaker`), `body` (≤2000), `film_id`, `line_id`, `payload jsonb`, `moderation_flag`, `created_at`, `deleted_at`.
- **shared_watchlist_items**: `match_id`, `film_id`, `added_by`, `created_at`.
- **daily_usage**: `user_id`, `day date`, `swipes_used`, `superlikes_used`, `rewinds_used`.
- **profile_views**: `viewer_id`, `viewed_id`, `viewed_on date`, UNIQUE üçlü.
- **profile_impressions**: `viewed_id`, `day`, `count` (adillik sınırı için).

### 9.6 Güvenlik, ödeme, sistem

- **blocks**: `blocker_id`, `blocked_id`, PK ikisi. (Tüm sorgularda iki yönlü filtre.)
- **reports**: `id`, `reporter_id`, `target_type` (`user|photo|post|comment|message|line`), `target_id`, `reason` (`fake_profile|underage|harassment|hate|sexual_content|spam|scam|spoiler_abuse|other`), `details`, `status` (`open|in_review|actioned|dismissed`), `assigned_to`, `resolution`, `resolved_at`.
- **moderation_actions**: `id`, `moderator_id`, `target_user_id`, `action` (`warn|remove_content|suspend|ban|unban`), `reason`, `expires_at`.
- **admin_roles**: `user_id`, `role` (`moderator|editor|admin`).
- **entitlements**: `user_id`, `entitlement` (`premium`), `expires_at`, `store`, `product_id`, `updated_at` (yalnızca RevenueCat webhook yazar).
- **consumable_balances**: `user_id`, `boosts`, `super_messages`.
- **consumable_ledger**: `id`, `user_id`, `kind`, `delta`, `source` (`purchase|use|grant|refund`), `store_transaction_id` (unique, idempotency).
- **active_boosts**: `user_id`, `starts_at`, `ends_at`.
- **notifications**: `id`, `user_id`, `type`, `actor_id`, `entity jsonb`, `read_at`.
- **ai_threads**, **ai_messages**: `role`, `content`, `input_tokens`, `output_tokens`, `model`.
- **app_config**: `key`, `value jsonb` (ör. `free_daily_swipes`, `free_daily_superlikes`, `max_daily_impressions`, `boost_duration_minutes`).
- **testimonials**: `id`, `locale`, `quote`, `display_name`, `city`, `consent_document_path`, `is_published`.

### 9.7 İndeksler (asgari)

`user_films(film_id) WHERE status='watched'`, `swipes(target_id, action)`, `messages(conversation_id, created_at desc)`, `posts(author_id, created_at desc)`, `posts(film_id, created_at desc)`, GiST `profile_locations(geog)`, `films` üzerinde `pg_trgm` başlık araması (tr/en translations), `notifications(user_id, read_at, created_at desc)`.

---

## 10. Sunucu Fonksiyonları (RPC + Edge Functions)

### 10.1 Postgres RPC'ler (`SECURITY DEFINER`, girdi doğrulamalı)

| RPC                                                     | Görev                                                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_discovery_deck(cursor)`                            | Bölüm 7.5'e göre kart listesi; mesafeyi kova olarak döner (`<1`, `1-5`, `5-10`, `10-25`, `25+` km)                                                                        |
| `swipe(target_id, action)`                              | Limit kontrolü + swipe kaydı + karşılıklıysa `matches` + `conversations` oluşturma + bildirim kuyruğu; tek transaction; eşzamanlı karşılıklı beğenide tek eşleşme garanti |
| `undo_last_swipe()`                                     | Premium kontrolü, son 1 swipe                                                                                                                                             |
| `get_likes_received(cursor)`                            | Premium değilse bulanık önizleme sayısı                                                                                                                                   |
| `unmatch(match_id)`                                     | Konuşmayı kapatır, ortak listeyi gizler                                                                                                                                   |
| `block_user(user_id)`                                   | Engelle + eşleşmeyi kaldır + takipleri sil                                                                                                                                |
| `record_profile_view(user_id)`                          | Günlük tekilleştirme                                                                                                                                                      |
| `upsert_user_film(...)`                                 | Sinematek güncelleme + yeniden hesap kuyruğu                                                                                                                              |
| `set_top_four(film_ids[])`                              | Tam 4 veya daha az, sıralı                                                                                                                                                |
| `get_shared_films(other_user_id)`                       | Ortak favoriler / ortak izlenenler / ortak liste                                                                                                                          |
| `use_boost()`, `send_super_message(recipient_id, body)` | Bakiye düşme + ledger, idempotent                                                                                                                                         |
| `get_weekly_stats()`                                    | Premium'a göre alan maskeleme                                                                                                                                             |
| `request_data_export()`, `request_account_deletion()`   | İş kuyruğuna ekler                                                                                                                                                        |

### 10.2 Edge Functions

| Fonksiyon            | Tetik                                                  | Görev                                                                                                                                       |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `tmdb-sync`          | pg_cron (günlük)                                       | popular, top_rated, now_playing (region TR), discover (`with_original_language=tr`) → films/people/credits/genres upsert, TR + EN çeviriler |
| `tmdb-lookup`        | istemci aramasında yerel sonuç yetersizse              | Tekil filmi çekip katalogda oluşturur (rate limitli)                                                                                        |
| `compute-compat`     | kuyruk + gece cron                                     | Bölüm 7                                                                                                                                     |
| `on-photo-upload`    | Storage webhook                                        | Görsel moderasyon (çıplaklık, reşit olmayan görünümü, yüz yoksa uyarı), blurhash                                                            |
| `moderate-text`      | gönderi/yorum/replik/bio/mesaj insert trigger → kuyruk | TR + EN küfür/taciz/iletişim bilgisi (telefon, IBAN) tespiti; eşik üstü `pending`                                                           |
| `send-push`          | notifications insert                                   | Kullanıcı bildirim tercihlerine göre push                                                                                                   |
| `revenuecat-webhook` | RevenueCat                                             | İmza doğrulama, `entitlements` ve `consumable_ledger` (idempotent)                                                                          |
| `ai-assistant`       | istemci (streaming)                                    | Bölüm 12                                                                                                                                    |
| `icebreakers`        | eşleşme oluşunca                                       | Şablon tabanlı (v1), AI destekli (v1.1)                                                                                                     |
| `weekly-stats`       | pazartesi cron                                         | İstatistik özeti + bildirim                                                                                                                 |
| `account-deletion`   | günlük cron                                            | Anında anonimleştirme, 30 gün sonra kalıcı silme (fotoğraflar dahil)                                                                        |
| `data-export`        | kuyruk                                                 | JSON + fotoğraflar ZIP, süreli imzalı link e-posta                                                                                          |
| `revalidate-web`     | film/koleksiyon/kişi güncellemesi                      | Next.js on-demand revalidation                                                                                                              |

---

## 11. Film Verisi (TMDB) Entegrasyonu

### 11.1 Strateji

- Başlangıç kataloğu: TMDB'den ~10.000 film (popülerlik + en yüksek puanlı + Türk yapımları + Türkiye vizyonu). Diğerleri kullanıcı araması ile tembel yüklenir.
- Görseller **TMDB image CDN'inden** URL olarak kullanılır (kendi sunucumuza kopyalanmaz). Boyutlar: liste `w185`, detay `w500`, backdrop `w1280`.
- Haftalık meta veri tazeleme; silinen/değişen kayıtlar işaretlenir.
- TMDB geliştirici anahtarı yoksa geliştirme ortamı `supabase/seed/films.fixture.json` (50 film, placeholder afişler) ile çalışmalı.

### 11.2 Lisans ve risk (ÖNEMLİ — kodla birlikte README'ye de yaz)

- TMDB API şartlarına göre **ticari kullanım** (abonelik, reklam, uygulama içi satın alma ile gelir elde eden ürün) **TMDB ile yazılı ticari anlaşma** gerektirir. Lansmandan önce bu anlaşma yapılmalı. (Açık Karar #3)
- TMDB şartları, TMDB içeriğinin yapay zekâ **eğitimi/doğrulaması** için kullanılmasını yasaklar. Film asistanı TMDB verisini model eğitmek için kullanmaz; yalnızca çalışma anında kullanıcıya bilgi göstermek için araç (tool) sonucu olarak iletilir — bunun da ticari anlaşmada açıkça teyit edilmesi gerekir.
- "Nerede izlenir" verisi JustWatch kaynaklıdır; ilgili bölümde **JustWatch atfı** gösterilmelidir.
- Kaynaktan gelen özetler (`overview_source`) atıfla gösterilir; SEO için kritik ilk 500 film ve 200 kişi için **özgün editoryal metin** yazılır (AI taslak + insan editör onayı; `editorial_status` alanı). Onaysız AI metni yayınlanmaz.
- Alternatif/yedek veri kaynakları ADR olarak değerlendirilmeli (ör. Wikidata CC0 meta verileri). Veri erişimi `FilmDataProvider` arayüzü arkasında soyutlanmalı ki sağlayıcı değiştirilebilsin.
- Bu bölüm hukuki danışmanlıkla doğrulanmalıdır.

### 11.3 Atıf

- Uygulamada "Hakkında/Künye" ekranında ve web footer'ında TMDB logosu (onaylı varyant) + "Bu ürün TMDB API'sini kullanır ancak TMDB tarafından onaylanmış veya sertifikalandırılmamıştır." ibaresinin güncel resmi metni.

---

## 12. Film Asistanı (AI) — v1.1

### 12.1 Davranış

- Çalışma adı: **Mira**. Ton: meraklı, sade, snob değil.
- Görevler: ruh haline/kişiye göre film önerisi ("Deniz'le ilk film gecesi için ikimizin de izlemediği bir şey"), Sinematek'e ekleme, bir filmin neden sevilebileceğini spoiler'sız anlatma, izleme listesi temizliği önerileri.
- **Yapamayacakları:** Diğer kullanıcılar hakkında kişisel bilgi vermek (yalnızca iki kişinin ortak film verisi, eşleşme varsa), eşleşme/uyum skorunu manipüle etmek, tıbbi/psikolojik tavsiye, spoiler (kullanıcı açıkça istemedikçe).

### 12.2 Uygulama

- Edge Function `ai-assistant`, Anthropic Messages API, streaming.
- Model: varsayılan hızlı/ucuz model (ör. `claude-haiku-4-5-20251001`), karmaşık öneri istekleri için `claude-sonnet-5`. **Model adlarını ve SDK kullanımını docs.claude.com'dan doğrula.** Model adı `app_config`'ten okunur.
- Araçlar (tool use): `search_films(query, filters)`, `get_my_library(summary)`, `get_shared_films(match_id)`, `add_to_watchlist(film_id)`, `get_where_to_watch(film_id, region)`. Yazma içeren araçlar istemcide onay kartı ile tamamlanır.
- Sistem promptu `supabase/functions/ai-assistant/prompt.md` dosyasında versiyonlu.
- Maliyet kontrolü: kullanıcı başına günlük mesaj limiti (ücretsiz/premium farklı), token kullanımı `ai_messages`'a yazılır, bağlam özetleme (son 20 mesaj + kütüphane özeti).
- Güvenlik: kullanıcı girdisi ve araç sonuçları talimat olarak değil veri olarak ele alınır (prompt injection koruması); çıktı moderasyonu.

---

## 13. Monetizasyon

### 13.1 Ücretsiz vs Premium

| Özellik                                                        | Ücretsiz                                                    | Premium                    |
| -------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------- |
| Günlük swipe                                                   | `app_config.free_daily_swipes` (varsayılan 25) + geri sayım | Sınırsız                   |
| Süper beğeni                                                   | Günde 1                                                     | Günde 5                    |
| Seni beğenenler                                                | Bulanık + sayı                                              | Açık liste                 |
| Geri al                                                        | —                                                           | Var                        |
| Gelişmiş filtreler (favori yönetmen, tür, on yıl, doğrulanmış) | —                                                           | Var                        |
| Haftalık istatistik                                            | Sadece sayı                                                 | Görüntüleyenler + sıralama |
| Okundu bilgisi                                                 | —                                                           | Var                        |
| Film asistanı günlük mesaj                                     | 10                                                          | 100                        |
| Sinematek, akış, sohbet, eşleşme                               | Tam                                                         | Tam                        |

**İlke:** Sinematek (takip) ve temel sohbet asla paywall arkasına konmaz. Ürünün bağımsız değeri budur ve mağaza incelemesinde (4.3) farklılaşmayı gösterir.

### 13.2 Ürünler (RevenueCat)

- Abonelik: `premium_weekly`, `premium_monthly`, `premium_annual` (tek entitlement: `premium`), yıllıkta ücretsiz deneme opsiyonu.
- Tüketilebilir: `boost_1`, `boost_3`, `boost_5`, `super_message_3`, `super_message_5`, `super_message_9`.
- Fiyatlar mağaza panellerinde belirlenir, kodda sabit fiyat yok; bölgesel fiyatlandırma (TRY) mağaza tarafında.
- Öne Çık: 30 dk boyunca bölgede desteye öncelikli girme.
- Süper Mesaj: eşleşmeden, profil kartından tek mesaj gönderme; alıcı "Kabul et / Sil" seçer; kabul edilirse konuşma açılır. Reddedilen süper mesaj iade edilmez (paywall'da açıkça yazılır).

### 13.3 Paywall tetikleyicileri

Limit dolunca, "seni beğenenler"e dokununca, geri al'a basınca, gelişmiş filtreye dokununca, haftalık istatistikte kilitli alana dokununca. Onboarding sonunda en fazla bir kez, atlanabilir.

---

## 14. Güvenlik, Moderasyon, Gizlilik ve Uyumluluk

### 14.1 Güvenlik özellikleri (MVP'de zorunlu)

- **Engelle:** Engellenen kişi hiçbir yüzeyde (deste, akış, yorum, arama, beğenenler, bahsetme) görünmez ve senin içeriğini göremez. İki yönlü filtre tüm RPC ve view'larda.
- **Şikâyet:** Kullanıcı, fotoğraf, gönderi, yorum, mesaj, replik. Şikâyet edilen mesajın bağlamı (önceki 20 mesaj) moderatör için anlık görüntü olarak saklanır.
- **Otomatik moderasyon:** Fotoğraflar onaylanmadan başkalarına gösterilmez. Metinlerde eşik üstü içerik yayından önce beklemeye alınır.
- **Dolandırıcılık sinyalleri:** İlk 5 mesajda harici bağlantı, telefon numarası, IBAN, kripto cüzdanı, "başka uygulamaya geçelim" kalıpları → alıcıya nazik güvenlik uyarısı bandı, rapor kuyruğunda sinyal puanı.
- **Yaş:** 18 yaş altı doğum tarihiyle kayıt olunamaz; doğum tarihi sonradan kullanıcı tarafından değiştirilemez (destek talebi gerekir). "Reşit olmadığını düşünüyorum" şikâyet sebebi en yüksek öncelik.
- **Admin paneli** (`apps/web/(admin)`, rol korumalı): şikâyet kuyruğu (öncelik, SLA sayacı), kullanıcı 360 görünümü, içerik kaldırma, uyar/askıya al/banla, moderasyon geçmişi, koleksiyon ve editoryal metin yönetimi, testimonial yayınlama, `app_config` düzenleme.
- **Topluluk kuralları** ve **güvenli buluşma ipuçları** sayfaları (uygulama içi + web).
- Kısıtlama: yeni hesaplarda ilk 24 saat günlük mesaj/gönderi limiti düşük (spam koruması).

### 14.2 Konum gizliliği

- Ham konum yalnızca `profile_locations`'da, istemci erişimi yok.
- Mesafe kova değerleriyle döner; 1 km altı asla gösterilmez. Konum ~500 m'ye yuvarlanarak saklanır. Trilaterasyon saldırılarına karşı mesafe değerine her sorguda değil, günlük sabit bir sapma (jitter) eklenir.
- Konum izni verilmezse şehir merkezi kullanılır.

### 14.3 KVKK / GDPR

- Kayıt sırasında **aydınlatma metni** ve ayrı ayrı **açık rıza** adımları: (a) ilgi duyulan cinsiyet gibi cinsel yönelimi ortaya koyabilecek veriler özel nitelikli kişisel veri sayılabilir, (b) konum, (c) pazarlama iletişimi, (d) analitik/izleme (iOS ATT ile uyumlu). Rızalar `consents` tablosunda sürümlü.
- Veri minimizasyonu, saklama süreleri politikası (`docs/data-retention.md`), veri dışa aktarma ve hesap silme uygulama içinden.
- Sunucular yurt dışındaysa (ör. Supabase AB bölgesi) yurt dışına aktarım mekanizması ve VERBİS yükümlülüğü **hukukçuyla** değerlendirilmeli.
- Analitik olaylarda mesaj içeriği, fotoğraf, konum veya cinsel yönelim verisi **gönderilmez**.

### 14.4 Mağaza kuralları (lansmandan önce güncel metinleri doğrula)

- **App Store 4.3 (spam/doygun kategori):** Tanışma uygulamaları doygun kategoride sayılır. Farklılaşmayı öne çıkar: film günlüğü ve sosyal akış bağımsız değer sunmalı; mağaza açıklaması ve ekran görüntüleri bunu göstermeli. Kategori olarak _Entertainment_ veya _Social Networking_ değerlendirilmeli.
- **App Store 1.2 (kullanıcı içeriği):** içerik filtreleme, şikâyet mekanizması, kullanıcı engelleme ve yayımlanmış iletişim bilgisi zorunlu.
- **Hesap silme:** Uygulama içinden başlatılabilmeli (Apple). Google Play ayrıca web üzerinden hesap silme talebi bağlantısı ister → `/[locale]/delete-account` sayfası.
- **Giriş:** Üçüncü taraf sosyal giriş sunuluyorsa Sign in with Apple (veya kurala uygun eşdeğer) sunulmalı.
- **Abonelik açıklamaları:** fiyat, süre, otomatik yenileme, iptal bilgisi paywall'da; "Satın alımları geri yükle" düğmesi.
- **İnceleme hesabı:** App Review için dolu profilli demo hesap ve eşleşmeye hazır test kullanıcıları (yalnızca inceleme ortamında görünen) hazırlanmalı.
- Yaş derecelendirmesi 18+.

---

## 15. Tasarım Sistemi

### 15.1 Konsept: "Gece seansı"

Referans alınan dünya bir **mahalle sinemasının gece seansı**: loş salonun lacivert karanlığı, perdenin serin beyazı, gişe biletinin pembesi, mısırın sarısı, eski Technicolor afişlerin derin turkuazı. Arayüz geri planda kalır; **renkli ve canlı olan şey film afişleridir.** Her şeyin sakin ve disiplinli olduğu bir sistemde tek cesur öğe **eşleşme bileti** anıdır (perforeli kenar ve koçan yırtılması). Bilet motifi yalnızca eşleşme anında ve satın alma makbuzlarında (Öne Çık, Süper Mesaj) kullanılır, başka yerde tekrarlanmaz.

Kaçınılacak klişeler: kırmızı kadife perde + altın rengi, film şeridi çerçeveleri, klaket ikonları her yerde, Netflix benzeri siyah + kırmızı, krem zemin + terracotta vurgu, her şeyin aynı radius ve gölgeli kartlara bölünmesi.

### 15.2 Renk token'ları

| Token       | Hex       | Kullanım                                                                                                                     |
| ----------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ink`       | `#1B2440` | Koyu temada zemin, açık temada ana metin                                                                                     |
| `screen`    | `#F4F7FB` | Açık temada zemin, koyu temada ana metin                                                                                     |
| `reel`      | `#17736E` | Birincil eylem (üstünde beyaz metin, kontrast ≈5.6:1)                                                                        |
| `ticket`    | `#F2547D` | Beğeni, eşleşme, kalp (üstünde `ink` metin; beyaz metin kullanma)                                                            |
| `popcorn`   | `#FFC23D` | Yıldız puanları, rozetler, vurgu (üstünde `ink` metin)                                                                       |
| `celluloid` | `#6E7689` | İkincil metin, çizgiler (açık zeminde yalnızca ≥14pt/kalın ya da ikincil bilgi için; AA kontrastını otomatik testle doğrula) |

Türetilmiş yüzeyler: koyu tema `surface-1 #252F52`, `surface-2 #313C63`; açık tema `surface-1 #FFFFFF`, `surface-2 #E8EDF5`. Durum renkleri (hata, başarı) bu paletle uyumlu olacak şekilde token paketinde tanımlanır. Tüm kombinasyonlar WCAG AA için otomatik testle kontrol edilir (`packages/tokens/contrast.test.ts`).

### 15.3 Tipografi

- **Başlık / sayı:** _Big Shoulders Display_ — dar, dikey, sinema markizi harflerini çağrıştırır. Büyük başlıklar, eşleşme bileti, istatistik sayıları, uyum yüzdesi.
- **Metin / arayüz:** _Hanken Grotesk_ — okunaklı, sıcak grotesk.
- Kurulumdan önce iki fontun **Türkçe karakter desteğini (ğ, Ğ, ş, Ş, ı, İ, ç, ö, ü)** render ederek doğrula; eksikse muadil öner.
- Tip ölçeği (mobil pt): 12 / 14 / 16 / 20 / 28 / 40 / 56. Metin satır aralığı 1.45, başlık 1.05. Satır uzunluğu web'de ≤ 72 karakter.
- Etiketlerde tümü büyük harf kullanılmaz. Başlıkta tek kelimeyi farklı renk/italikle vurgulama yapılmaz.
- Büyük/küçük harf dönüşümleri `tr-TR` locale ile yapılır (`i → İ`, `ı → I`).

### 15.4 Biçim ve düzen

- Afiş oranı 2:3, köşe yarıçapı 6 (fiziksel afiş hissi). Kart 16, bottom sheet 24, buton tam yuvarlak değil 12.
- Derinlik gölgeyle değil yüzey tonlarıyla verilir. Gölge yalnızca swipe kartında (sürüklenirken artar).
- Web içerik düzeni sola hizalı; landing hero'da sol tarafta büyük markiz tipografi, sağda telefon mockup'ı.
- Izgara: mobilde 4 pt tabanlı boşluk, web'de 12 kolon.
- İkonlar: tek bir set (ör. Phosphor), tutarlı çizgi kalınlığı. Film durumları için: göz (izledim), yer imi (listem), yıldız (puan), kalp (beğeni).

### 15.5 Hareket

- Kullanıcı eylemine cevap veren hareketler serbest ve anlamlı: swipe fiziği, puan verirken yıldız dolması, listeye ekleyince afişin sekme ikonuna küçülerek uçması.
- Kendiliğinden hareket yalnızca eşleşme biletinde. Web landing'de tek bir sayfa yükleme sekansı; her bölümde fade-in yok.
- `prefers-reduced-motion` / iOS Reduce Motion her yerde uygulanır.

### 15.6 Yazım dili

- "Sen" dili, sade fiiller, cümle düzeni harf kullanımı.
- Bir eylem akış boyunca aynı adı taşır: buton "Listeye ekle" → bildirim "Listene eklendi".
- Boş durumlar yönlendirir: Sinematek boşken _"İlk filmini ekle. Dün akşam izlediğin film bile yeter."_ Eşleşme yokken _"Sinematek'in büyüdükçe uyum hesapları netleşir. 5 film daha eklemeyi dene."_
- Hatalar ne olduğunu ve ne yapılacağını söyler, özür dilemez: _"Mesaj gönderilemedi. Bağlantını kontrol edip tekrar dene."_
- Sinefil ama elitist değil; "tutkunlar için eşsiz deneyim" tarzı pazarlama klişeleri yok.

### 15.7 Erişilebilirlik

Dokunma hedefleri ≥ 44pt, dinamik yazı boyutu desteği, tüm swipe eylemlerinin buton alternatifi, VoiceOver/TalkBack etiketleri (afişlerde film adı + yıl), renk tek başına anlam taşımaz (beğen/geç ikon + metin), odak halkaları web'de görünür.

---

## 16. Çok Dillilik (i18n)

- Diller: `tr` (varsayılan, Türkiye), `en`. Cihaz diline göre başlangıç, ayarlardan değiştirilebilir.
- Ortak çeviri dosyaları `packages/i18n/{tr,en}.json`; mobilde i18next, web'de next-intl aynı anahtarları kullanır. ICU çoğul kuralları.
- Kod içinde kullanıcıya görünen sabit metin yok (ESLint kuralı ile denetlenir).
- Film başlıkları: kullanıcının diline göre yerel başlık, altında orijinal başlık (farklıysa).
- Tarih/sayı: `Intl` API'leri, `tr-TR` / `en-US`.
- Slug üretimi: `packages/i18n/slugify.ts` (Türkçe karakter dönüşümleri + testler).

---

## 17. Analitik ve Başarı Metrikleri

### 17.1 Olay taksonomisi (`docs/events.md`, isimler snake_case)

`app_opened`, `signup_started`, `signup_completed`, `onboarding_step_completed {step}`, `taste_test_completed {rated_count, duration_s}`, `top_four_set`, `film_status_changed {status, source}`, `film_rated {rating_bucket}`, `diary_entry_created`, `line_created`, `discover_card_viewed`, `swipe {action, compat_bucket}`, `swipe_limit_reached`, `match_created {compat_bucket, reasons_count}`, `icebreaker_used`, `message_sent {kind, is_first}`, `conversation_reached_10_messages`, `shared_watchlist_item_added`, `post_created {type, has_spoiler}`, `post_liked`, `comment_created`, `follow_requested`, `paywall_viewed {trigger}`, `purchase_started {product}`, `purchase_completed {product}`, `boost_used`, `super_message_sent`, `report_submitted {target_type, reason}`, `user_blocked`, `assistant_message_sent`, `web_cta_clicked {page_type, position}`.

Olay özelliklerinde kişisel veri, mesaj içeriği, cinsel yönelim, kesin konum yok.

### 17.2 Kuzey yıldızı ve takip metrikleri

- **Kuzey yıldızı:** Haftalık "anlamlı konuşma" sayısı (eşleşme sonrası her iki tarafın da ≥5 mesaj attığı konuşmalar).
- Onboarding tamamlama oranı, zevk testi süresi, D1/D7/D30 elde tutma, eşleşme oranı (beğeni başına), eşleşmelerin 24 saatte ilk mesaj oranı, icebreaker kullanım oranı, Sinematek medyan büyüklüğü, ödeme dönüşümü (paywall görüntüleme → satın alma), şikâyet oranı (1.000 aktif kullanıcı başına), şikâyet çözüm süresi.

---

## 18. Test Stratejisi ve CI/CD

### 18.1 Testler

- **Birim (Vitest):** `packages/core` eşleşme algoritması (%90+ satır kapsamı), property-based testler (simetri, sınırlar, monotonluk), slugify, tr-TR harf dönüşümleri, fiyat/limit mantığı, zod şemaları.
- **Veritabanı:** Her tablo için RLS testleri (başka kullanıcının mesajını/konumunu/şikâyetini okuyamama, engellenen kullanıcıyı görememe), `swipe` RPC eşzamanlılık testi (karşılıklı beğeni aynı anda → tek eşleşme), limit aşımı, idempotent ledger.
- **Edge Functions:** RevenueCat webhook imza ve tekrar gönderim, moderasyon eşikleri, TMDB sync (fixture ile).
- **Web (Playwright):** landing, film sayfası, koleksiyon, dil değiştirme, hreflang ve JSON-LD doğrulama, 404'ler, CTA bağlantı parametreleri.
- **Mobil E2E (Maestro):** kayıt → zevk testi → keşfet → seed kullanıcıyla eşleşme → mesaj; Sinematek'e ekleme; şikâyet + engelleme; paywall açılışı.
- **Erişilebilirlik:** token kontrast testleri, web'de axe.

### 18.2 Seed verisi (yalnızca yerel/staging)

- 60 sahte kullanıcı, farklı zevk kümeleri (ör. "Yeşilçam sever", "bilim kurgu", "festival sineması", "gişe filmleri"), onaylı placeholder fotoğraflar (üretilmiş/lisanslı, gerçek kişi fotoğrafı değil).
- Seed betiği prod ortamında çalışmayı reddeder (ortam kontrolü).

### 18.3 CI/CD

- PR başına: `pnpm lint`, `pnpm typecheck`, `pnpm test`, Supabase migration doğrulama (yerel DB'de uygula + RLS testleri), web build, Playwright smoke.
- Ana dala birleşme: web → Vercel preview/prod; mobil → EAS Build (internal), EAS Update kanalları (`development`, `preview`, `production`).
- Migration'lar prod'a yalnızca manuel onaylı iş akışıyla uygulanır.
- Conventional Commits + otomatik CHANGELOG.

---

## 19. Geliştirme Fazları ve Kabul Kriterleri

> Her faz ayrı bir dal ve PR serisi. Faz bitmeden sonrakine geçme. Her fazın sonunda: kabul kriterleri kontrol listesi, ekran görüntüleri (mobil simülatör + web), kalan işler ve riskler.

### Faz 0 — Temel kurulum

- Monorepo, pnpm, Turborepo, TypeScript strict, ESLint (i18n sabit metin kuralı dahil), Prettier, Husky + lint-staged.
- `apps/mobile` (Expo + expo-router + NativeWind), `apps/web` (Next.js + next-intl + Tailwind), `packages/*` iskeletleri.
- `packages/tokens`: bölüm 15 token'ları, açık/koyu tema, Tailwind + NativeWind preset, kontrast testi.
- Supabase yerel ortam, ilk migration (extensions: postgis, pg_trgm, pg_cron), `.env.example`, GitHub Actions.
- `CLAUDE.md`, `docs/PRD.md`, `docs/adr/0001-stack.md`.

**Kabul:** `pnpm dev` ile web ve mobil (iOS simülatör + Android emülatör) açılıyor; tema değişimi çalışıyor; iki font Türkçe karakterleri doğru gösteriyor; CI yeşil.

### Faz 1 — Film kataloğu ve veri katmanı

- 9.2 tabloları + RLS (herkese okuma, yalnızca service role yazma).
- `FilmDataProvider` arayüzü, TMDB implementasyonu, fixture implementasyonu.
- `tmdb-sync` ve `tmdb-lookup`, `film_stats` cron.
- Arama RPC'si (TR/EN başlık, trigram, yıl ile belirsizlik giderme).
- Başlangıç koleksiyonları için seed (film listeleri + özgün giriş metinleri için placeholder alanlar).

**Kabul:** Anahtar varsa ≥10.000 film yükleniyor, yoksa fixture ile her şey çalışıyor; "ask zamani", "Aşk Zamanı" ve "in the mood for love" aramalarının üçü de aynı filmi ilk sırada getiriyor (aksansız Türkçe arama dahil); yetişkin içerik katalogda yok; sync iki kez çalıştırıldığında yinelenen kayıt yok.

### Faz 2 — Web sitesi (SEO)

- Bölüm 6'daki tüm sayfalar, TR/EN, landing metinleri, SSS, footer, TMDB atfı.
- JSON-LD, sitemap, robots, OG görselleri, canonical/hreflang, `/download` akıllı yönlendirme, `/delete-account`.
- Attribution parametreli CTA bileşeni, mobilde yapışkan alt bar (kapatılabilir, oturum boyunca hatırlanır — tarayıcı depolaması yerine çerez).
- Yasal sayfalar için şablon (metinler hukukçu onayı bekliyor olarak işaretli).

**Kabul:** Film sayfası mobil Lighthouse: Performans ≥ 90, SEO ≥ 95, Erişilebilirlik ≥ 95; Rich Results testinde `Movie` ve `BreadcrumbList` hatasız; hreflang çiftleri doğru; tüm metinler i18n'den.

### Faz 3 — Kimlik, profil, onboarding

- Supabase Auth (Apple, Google, e-posta OTP), 9.1 tabloları + RLS, fotoğraf yükleme (sıkıştırma, sıralama, silme), `on-photo-upload` moderasyonu (sağlayıcı arayüzü + geliştirme için sahte sağlayıcı).
- Bölüm 4-A akışının tamamı, zevk testi (film seçimi `app_config`'ten, dönem/ülke/tür dengeli), Kadrajım seçimi, profil soruları, rıza adımları, konum.
- Profil düzenleme, ayarlar iskeleti, dil ve tema ayarı.

**Kabul:** Yeni kullanıcı onboarding'i 3 dakikanın altında tamamlayabiliyor; 18 yaş altı kayıt imkânsız; onaysız fotoğraf başka kullanıcıya hiçbir sorguda dönmüyor; rızalar sürümlü kaydediliyor; onboarding yarıda bırakılınca kaldığı adımdan devam ediyor.

### Faz 4 — Sinematek

- 9.3 tabloları, `upsert_user_film`, `set_top_four`, günlük, replikler, istatistik ekranı, film ve kişi detay ekranları (uygulama içi), arama ekranı.
- İyimser güncellemeler + çevrimdışı mutasyon kuyruğu.

**Kabul:** Uçak modunda eklenen film bağlantı gelince senkronize oluyor; bir filmi puanlamak 2 dokunuşu geçmiyor; istatistikler seed verisiyle doğru; değişiklik sonrası kullanıcı yeniden hesap kuyruğuna düşüyor.

### Faz 5 — Keşfet ve eşleşme

- `packages/core` algoritması + testler, `compute-compat`, `get_discovery_deck`, `swipe`, `undo_last_swipe`, `get_likes_received`, günlük limit + geri sayım ekranı, filtreler, eşleşme bileti animasyonu, `reasons` üretimi.
- Temel engelle + şikâyet (profil kartından) bu fazda devreye girer.

**Kabul:** Algoritma testleri yeşil (simetri, aralık, aynı profil = maksimum); eşzamanlı karşılıklı beğenide tek eşleşme; engellenen/banlı/onaysız fotoğraflı profiller destede asla yok; mesafe 1 km altı gösterilmiyor; limit sıfırlama kullanıcının saat dilimine göre; deste ilk kartı p95 < 800 ms (seed verisiyle yerel).

### Faz 6 — Sohbet

- 9.5 sohbet tabloları, Supabase Realtime abonelikleri, mesaj türleri, film/replik kartı gönderme, şablon icebreaker'lar, okundu bilgisi (premium gösterim), push bildirimleri, eşleşmeyi kaldırma, mesajdan şikâyet, dolandırıcılık uyarı bandı, ortak izleme listesi.

**Kabul:** RLS: konuşma üyesi olmayan hiçbir mesajı okuyamıyor; uygulama arka plandayken push geliyor, dokununca doğru sohbet açılıyor; eşleşme kaldırılınca her iki tarafta da konuşma kapanıyor; mesaj listesi 1.000 mesajda akıcı kayıyor.

### Faz 7 — Sosyal akış

- 9.4 tabloları, gönderi türleri, oluşturma ekranı, beğeni/yorum/repost/alıntı/yer imi/bahsetme, takip + takip istekleri, gizli hesap, spoiler bulanıklığı, bildirimler ekranı, film sayfasında topluluk gönderileri, `public_web_posts` view'ı ve web entegrasyonu, metin moderasyonu.
- Akış sıralaması v1: takip edilenler (kronolojik) + "Keşfet" sekmesi (Sinematek'indeki filmlerle ilgili, etkileşim ve yeniliğe göre).

**Kabul:** Spoiler işaretli içerik varsayılan bulanık, dokununca açılıyor; `web_posts_public=false` kullanıcının hiçbir içeriği web'de yok; bahsedilen kişi bildirim alıyor ama engellediyse almıyor; sayaçlar trigger ile tutarlı.

### Faz 8 — Monetizasyon ve istatistik

- RevenueCat entegrasyonu, paywall (dinamik offering), entitlement senkronizasyonu, tüketilebilirler + ledger, Öne Çık, Süper Mesaj akışı (kabul/sil), premium kapıları (bölüm 13.1), haftalık istatistik ekranı ve cron'u, geri yükleme.

**Kabul:** iOS sandbox ve Google Play test hesaplarıyla tüm ürünler satın alınabiliyor; aynı webhook iki kez gelince bakiye iki kez artmıyor; abonelik süresi dolunca kapılar kapanıyor; paywall'da yasal zorunlu metinler var.

### Faz 9 — Güvenlik, admin ve uyumluluk tamamlama

- Admin paneli (bölüm 14.1), moderasyon playbook'u (`docs/moderation-playbook.md`), hesap silme ve veri dışa aktarma işleri, rıza yönetimi ekranı, konum jitter, yeni hesap kısıtlamaları, rate limitler, topluluk kuralları ve güvenli buluşma sayfaları.

**Kabul:** Hesap silme sonrası kullanıcı hiçbir yüzeyde görünmüyor ve 30 gün sonra verisi kalıcı siliniyor (test ile); dışa aktarma dosyası kullanıcının tüm verisini içeriyor; moderatör şikâyeti 3 tıklamada çözebiliyor; tüm eylemler denetim kaydına yazılıyor.

### Faz 10 — Lansman hazırlığı

- PostHog olayları (bölüm 17), Sentry, performans profilleme, erişilebilirlik denetimi, uygulama ikonları/splash, mağaza ekran görüntüleri için demo verisi, App Review demo hesabı ve notları, deep link + attribution kurulumu, web ↔ uygulama universal links / app links, son güvenlik gözden geçirmesi (RLS, anahtar sızıntısı taraması).

**Kabul:** Bölüm 14.4 kontrol listesinin tamamı işaretli; tüm funnel olayları PostHog'da görünüyor; crash-free oturum hedefi ≥ %99.5 (iç test grubunda).

### Faz 11 (v1.1) — Film asistanı ve büyüme özellikleri

- Bölüm 12 asistan, AI destekli icebreaker'lar, film gecesi planlayıcı, Sinema Karnesi paylaşım görseli, selfie doğrulama, Letterboxd CSV içe aktarma.

---

## 20. Ortam Değişkenleri (`.env.example`)

```
# Ortak
NODE_ENV=
APP_ENV=local|staging|production

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=            # yalnızca sunucu / edge functions
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Film verisi
TMDB_API_READ_ACCESS_TOKEN=
FILM_DATA_PROVIDER=tmdb|fixture

# AI
ANTHROPIC_API_KEY=                     # yalnızca edge function

# Ödeme
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
REVENUECAT_WEBHOOK_AUTH=

# Moderasyon
MODERATION_PROVIDER=mock|<sağlayıcı>
MODERATION_API_KEY=

# Gözlemleme
SENTRY_DSN_MOBILE=
SENTRY_DSN_WEB=
EXPO_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_KEY=

# Web
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_APP_STORE_URL=
NEXT_PUBLIC_PLAY_STORE_URL=
NEXT_PUBLIC_ATTRIBUTION_LINK_BASE=
REVALIDATE_SECRET=

# E-posta
RESEND_API_KEY=
```

---

## 21. Açık Kararlar (başlamadan önce bana sor)

| #   | Karar                                                                                              | Varsayılan                                          |
| --- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | Uygulamanın kalıcı adı ve alan adı (marka tescil araştırması yapılmalı)                            | Movieholix (placeholder)                            |
| 2   | Backend: Supabase mi, özel Node.js (NestJS) + Postgres mi?                                         | Supabase                                            |
| 3   | TMDB ticari lisans görüşmesi başladı mı? Lisans yoksa lansman öncesi alternatif veri kaynağı planı | Geliştirme TMDB geliştirici anahtarı + fixture ile  |
| 4   | Lansman pazarları ve dil sırası                                                                    | Türkiye (TR + EN)                                   |
| 5   | Arkadaşlık ve film arkadaşı modu v1'de mi?                                                         | Evet                                                |
| 6   | Görsel/metin moderasyon sağlayıcısı                                                                | Arayüz + mock, sağlayıcı sonra seçilir              |
| 7   | Attribution sağlayıcısı (Adjust / AppsFlyer / Branch)                                              | Karar ertelenir, CTA bileşeni sağlayıcıdan bağımsız |
| 8   | Ücretsiz günlük swipe sayısı ve premium fiyat bandı                                                | 25 swipe; fiyatlar mağazada                         |
| 9   | Film asistanının adı ve lansman zamanı                                                             | Mira, v1.1                                          |
| 10  | Kullanıcı gönderilerinde görsel paylaşımı                                                          | v1'de yok                                           |
| 11  | Web gönderi görünürlüğü varsayılanı                                                                | Kapalı (opt-in)                                     |
| 12  | Tasarım konsepti "Gece seansı" onaylanıyor mu, yoksa önce 2 alternatif moodboard mı?               | Onaylı varsay, Faz 0'da token ekranı göster         |

---

## 22. `CLAUDE.md` İçeriği (kök dizine oluştur)

```md
# CLAUDE.md — Movieholix

## Proje

Film zevki üzerinden tanışma + film günlüğü + sinefil sosyal akış. Tam spesifikasyon: docs/PRD.md.
Referans ürün Bookspace'tir; ondan metin, görsel, logo, renk veya marka öğesi kopyalanmaz.

## Komutlar

- pnpm dev # web + mobil + supabase
- pnpm lint / pnpm typecheck / pnpm test
- pnpm db:reset # yerel DB sıfırla + migration + seed
- pnpm db:test # RLS ve RPC testleri
- pnpm e2e:web / pnpm e2e:mobile

## Çalışma kuralları

1. Her fazın başında plan yaz, onay al. Faz sonunda lint + typecheck + test çalıştır ve kabul kriterlerini tek tek raporla.
2. Sürüm, API ve platform kurallarını güncel resmi dokümantasyondan doğrula; hafızaya güvenme.
3. TypeScript strict. `any` yasak (gerekirse gerekçeli `unknown` + daraltma). Tüm dış girdiler zod ile doğrulanır.
4. Kullanıcıya görünen her metin packages/i18n'den gelir (tr + en birlikte eklenir).
5. Her yeni tabloda RLS + politika + RLS testi aynı PR'da. Service role anahtarı istemci koduna asla girmez.
6. Para, limit, eşleşme, bakiye işlemleri tek transaction'lı ve idempotent RPC'lerde.
7. Gizli anahtar commit edilmez; yeni değişken eklenince .env.example güncellenir.
8. Migration'lar yalnızca ileri yönlü; prod veritabanına doğrudan komut çalıştırılmaz.
9. Analitik olaylarına kişisel veri, mesaj içeriği, kesin konum veya cinsel yönelim bilgisi eklenmez.
10. Prod'da sahte kullanıcı, sahte yorum veya sahte testimonial olmaz. Seed betikleri prod'da çalışmaz.
11. Tasarım token'ları dışında renk/font/boşluk değeri yazılmaz. Erişilebilirlik (44pt hedef, AA kontrast, ekran okuyucu etiketi) her bileşende zorunlu.
12. Önemli mimari kararlar docs/adr/ altına kısa ADR olarak yazılır.
13. Emin olmadığın ürün kararlarında tahmin yürütüp büyük yapı kurma; dur ve sor.
14. Conventional Commits; küçük, gözden geçirilebilir PR'lar.

## Mimari özet

apps/mobile (Expo), apps/web (Next.js + admin), packages/core (domain + eşleşme algoritması),
packages/api, packages/tokens, packages/i18n, packages/config, supabase/ (migrations, functions, tests, seed).
```

---

**Son not (Claude Code'a):** Bu doküman bir başlangıç noktasıdır. Uygulama sırasında bir bölümün teknik olarak kötü bir fikir olduğunu, bir platform kuralıyla çeliştiğini veya daha basit bir yolu olduğunu fark edersen, sessizce sapma: gerekçesiyle öner, onay al, ADR'ye yaz.
