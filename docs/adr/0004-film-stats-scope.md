# ADR 0004 — `film_stats`in Faz 1 Kapsamı

- Durum: Kabul edildi
- Tarih: 2026-09-11

## Karar

PRD bölüm 19 (Faz 1) "film_stats cron"u listeler, ancak `film_stats` alanlarının (`watched_count`, `watchlist_count`, `avg_rating`, `rating_count`, `weekly_adds`, `idf`) gerçek değerleri şu tablolara bağlıdır:

- `watched_count`/`watchlist_count`/`avg_rating`/`rating_count`: `user_films` tablosu (**Faz 4 — Sinematek**).
- `idf`: PRD 7.2 formülü aktif kullanıcı sayısına ve kaç kullanıcının filmi izlediğine bağlı; anlamlı olması için Faz 4 (Sinematek) ve gerçek kullanıcı tabanı gerekir.

Bu tablolar Faz 1'de henüz yok. Bu yüzden Faz 1'de yalnızca:

1. `film_stats` tablosu (şema + RLS) açılır.
2. Her yeni filme otomatik sıfırlanmış bir satır garanti eden basit bir gece cron'u (`film_stats_bootstrap`) kurulur.

Gerçek `watched_count`/`avg_rating`/`idf` hesaplama mantığı Faz 4/5'te (Sinematek ve eşleşme algoritması) eklenecek.

## Gerekçe

PRD'nin kendi notu (bölüm 0.5): "Emin olmadığın ürün kararlarında tahmin yürütüp büyük yapı kurma; dur ve sor" ve (son not): "bir bölümün teknik olarak kötü bir fikir olduğunu... fark edersen sessizce sapma: gerekçesiyle öner, onay al, ADR'ye yaz." Var olmayan tablolara referans veren bir hesaplama fonksiyonu yazmak yerine, kapsamı netleştirip ileri fazlara erteledik.

## Sonuç

Faz 4 planında `film_stats`i gerçek `user_films` verisiyle güncelleyen bir trigger/cron eklenecek; Faz 5 planında `idf` hesaplaması (PRD 7.2) eklenecek.
