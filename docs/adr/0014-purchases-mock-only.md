# ADR 0014 — RevenueCat SDK'sı Entegre Edilmez; `PurchasesProvider` Mock

- Durum: Kabul edildi
- Tarih: 2026-09-17

## Karar

Faz 8, gerçek RevenueCat panosu erişimi ve gerçek App Store Connect / Google Play Console sandbox test hesapları olmadan yürütüldü. Bu nedenle:

- `react-native-purchases` (gerçek RevenueCat SDK'sı) bağımlılık olarak eklenmedi.
- Mobil tarafta `apps/mobile/src/lib/purchases.ts`, Faz 3'ün `ModerationProvider` deseniyle aynı şekilde bir `PurchasesProvider` arayüzü (`getOfferings`, `purchasePackage`, `restorePurchases`) tanımlar; tek uygulama `MockPurchasesProvider`'dır. `EXPO_PUBLIC_REVENUECAT_IOS_KEY`/`ANDROID_KEY` boşsa (bu ortamda hep boş) mock seçilir — gerçek anahtarlar eklendiğinde yalnızca yeni bir `RevenueCatProvider` sınıfı yazılır, çağıran kod değişmez.
- `MockPurchasesProvider.purchasePackage()`, gerçek bir mağaza satın alması yerine `revenuecat-webhook` fonksiyonuna gerçek RevenueCat payload şekline uygun sentetik bir olay POST'lar (paylaşılan gizli anahtarla, `REVENUECAT_WEBHOOK_AUTH`). Böylece istemci→webhook→`entitlements`/`consumable_ledger` kod yolunun tamamı gerçek ve test edilebilir kalır; simüle edilen tek şey "kullanıcı gerçekten ödedi" adımıdır.

## Gerekçe

Sahte bir SDK yazıp gerçek entegrasyonu taklit etmek yerine, PRD'nin kendi "arayüz + mock, sağlayıcı sonra seçilir" ilkesi (bölüm 21, ADR-0008/ModerationProvider emsali) tekrarlanıyor. Webhook'un idempotency ve entitlement senkronizasyon mantığı — Faz 8'in gerçek riskli kısmı — sentetik payload'larla tam kapsamlı test edilebiliyor; yalnızca mağaza tarafı (fiyatlandırma UI'ı, gerçek ödeme akışı, sandbox hesap davranışı) test dışı kalıyor.

## Sonuç

PRD'nin Faz 8 kabul kriterinden ("iOS sandbox ve Google Play test hesaplarıyla tüm ürünler satın alınabiliyor") yalnızca bu madde test edilemez olarak raporlanacak; diğer üç madde (webhook idempotency, süre dolunca kapı kapanması, paywall yasal metni) gerçek şekilde doğrulanacak. Gerçek SDK entegrasyonu, gerçek RevenueCat/mağaza pano erişimi sağlandığında ayrı bir iş olarak yapılmalı.
