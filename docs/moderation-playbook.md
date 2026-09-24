# Moderasyon Playbook'u

PRD bölüm 14.1, Faz 9. Bu doküman moderatörlerin şikâyet kuyruğunu nasıl işleyeceğini tarif eder.

## Önceliklendirme

`admin_list_reports()` şikâyetleri şu sıraya göre döner (en öncelikli önce):

1. `underage` (reşit olmadığını düşünüyorum) — **en yüksek öncelik**, PRD 14.1'in açık talimatı.
2. `harassment`, `hate` — güvenlik riski.
3. `scam` — dolandırıcılık sinyali.
4. Diğer tüm sebepler (`fake_profile`, `sexual_content`, `spam`, `spoiler_abuse`, `other`).

Aynı öncelik grubunda en eski şikâyet önce gösterilir (SLA'yı aşma riski en yüksek olan).

## SLA hedefleri (öneri, hukuk/güven ekibiyle teyit edilmeli)

| Öncelik               | Hedef ilk müdahale |
| --------------------- | ------------------ |
| `underage`            | 2 saat             |
| `harassment` / `hate` | 8 saat             |
| `scam`                | 24 saat            |
| Diğer                 | 48 saat            |

## Üç tıklamalık akış

1. **Kuyruk** (`/admin/reports`) — açık şikâyetleri listele.
2. **Detay** (`/admin/reports/[id]`) — şikâyetin tam bağlamını gör (mesaj şikâyetlerinde son 20 mesajlık anlık görüntü `context_snapshot`'ta).
3. **Karar** — aynı sayfadaki formdan tek tıkla: Reddet (asılsız) / Uyar / İçeriği kaldır / Askıya al / Banla.

Her karar `moderation_actions` tablosuna (uyar/kaldır/askı/ban için) ve `reports.status`/`resolution`'a (her zaman) yazılır — denetim kaydı otomatik.

## Eylem rehberi

- **Uyar:** İlk/hafif ihlaller (spoiler, hafif spam). Kullanıcıya bildirim gitmez (v1 kapsamı dışı), yalnızca kayıt tutulur.
- **İçeriği kaldır:** Kural ihlali eden tek bir gönderi/yorum/fotoğraf/replik; kullanıcının hesabı etkilenmez.
- **Askıya al:** Tekrarlanan ihlaller, orta düzey risk. Varsayılan süre 7 gün (`admin_moderate_user`'a `p_expires_at` verilmezse).
- **Banla:** Ciddi ihlaller (taciz, nefret söylemi, dolandırıcılık, reşit olmama şüphesi doğrulandıysa). Kalıcı, yalnızca `unban` ile geri alınır.
- **Reşit olmama şüphesi:** Şüphe makul görünüyorsa hemen banla, destek ekibine eskalasyon yap (bu dokümanın kapsamı dışında bir insan süreci).

## Eskalasyon

Bu playbook'un kapsamadığı durumlar (hukuki talep, basın ilgisi, kritik güvenlik açığı) için ekip liderine eskalasyon yapılır — ayrı bir kanal/süreç bu dokümanın kapsamı dışında.
