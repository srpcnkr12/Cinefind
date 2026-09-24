// Demo/staging için film kapak görselleri üretir ve `films.poster_path`'i doldurur.
//
// Neden: gerçek bir TMDB anahtarı olmadan fixture kataloğundaki 40 filmin
// hiçbirinde poster yok ve uygulamadaki her poster yüzeyi boş gri kutu
// görünüyor. Bu betik, marka paletinden türeyen soyut kapaklar üretip public
// bir Storage bucket'ına yükler. Gerçek TMDB anahtarı gelince `tmdb-sync`
// poster_path'leri gerçek TMDB yollarıyla ezer ve bu görsellere gerek kalmaz.
//
// Görseller kasıtlı olarak soyuttur: gerçek film afişleri telifli, bunları
// taklit etmek de yanıltıcı olur. Filmin adı zaten posterin yanında yazıyor.
//
// Çalıştırma:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/seed/film-art.mjs

import { createClient } from "@supabase/supabase-js";
import {
  blend,
  circle,
  createCanvas,
  encodePng,
  fill,
  glow,
  hashString,
  hexToRgb,
  mix,
  rect,
  ring,
  vignette,
} from "./lib/png.mjs";

if (process.env.APP_ENV === "production") {
  console.error(
    "Bu betik prod ortamında çalışmayı reddeder (CLAUDE.md kural #10).",
  );
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri gerekli.",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BUCKET = "film-art";
const WIDTH = 342;
const HEIGHT = 513; // TMDB w342 posteriyle aynı 2:3 oran

// packages/tokens/src/raw.cjs ile aynı marka paleti.
const INK = hexToRgb("#1B2440");
const LIGHT = hexToRgb("#F4F7FB");
const NEAR_BLACK = hexToRgb("#0B1020");
// Her çift: [koyu taban, canlı vurgu]. Taban koyu tutuluyor ki poster küçük
// thumbnail'de bile derin görünsün, vurgu üst köşede canlı kalsın.
const PAIRS = [
  ["#1B2440", "#17736E"],
  ["#1B2440", "#F2547D"],
  ["#1B2440", "#FFC23D"],
  ["#0F2E2C", "#FFC23D"],
  ["#2A1030", "#F2547D"],
  ["#1B2440", "#1B6E49"],
  ["#30100E", "#C4433B"],
  ["#252F52", "#F4F7FB"],
  ["#12202E", "#17736E"],
  ["#1F1A2E", "#FFC23D"],
];

function poster(seedKey) {
  const hash = hashString(seedKey);
  const canvas = createCanvas(WIDTH, HEIGHT);

  // Her karar hash'in farklı bitlerinden türüyor; aynı düşük bitleri kullanmak
  // seçimleri birbirine bağlayıp bütün posterleri aynılaştırıyordu.
  const pairIndex = hash % PAIRS.length;
  const motifIndex = (hash >>> 11) % 5;
  const flip = ((hash >>> 19) & 1) === 1;

  const [deepHex, accentHex] = PAIRS[pairIndex];
  const deep = mix(hexToRgb(deepHex), NEAR_BLACK, 0.2);
  const accent = hexToRgb(accentHex);

  // 1) Üst köşede canlı vurgu, alta doğru koyu tabana inen degrade
  fill(canvas, (x, y) => {
    const hx = flip ? 1 - x / WIDTH : x / WIDTH;
    const t = hx * 0.3 + (1 - y / HEIGHT) * 0.85 - 0.12;
    return mix(deep, accent, Math.max(0, Math.min(1, t)));
  });

  // 2) Vurgu köşesinde yumuşak ışık
  glow(
    canvas,
    WIDTH * (flip ? 0.22 : 0.78),
    HEIGHT * 0.14,
    WIDTH * 0.95,
    mix(accent, LIGHT, 0.55),
    0.35,
  );

  // 3) Filme göre değişen geometrik motif
  const motif = mix(LIGHT, accent, 0.2);
  switch (motifIndex) {
    case 0:
      ring(canvas, WIDTH * 0.6, HEIGHT * 0.6, WIDTH * 0.34, 3, motif, 0.75);
      ring(canvas, WIDTH * 0.6, HEIGHT * 0.6, WIDTH * 0.21, 2, motif, 0.45);
      break;
    case 1: {
      // Köşeden köşeye çapraz bant
      const nx = Math.cos(-0.9);
      const ny = Math.sin(-0.9);
      const half = WIDTH * 0.07;
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const d = Math.abs(x * nx + y * ny - WIDTH * 0.12);
          if (d < half)
            blend(canvas, x, y, motif, 0.5 * Math.min(1, (half - d) / 6));
        }
      }
      break;
    }
    case 2:
      // Ufuk çizgisinin üstünde yükselen daire
      circle(canvas, WIDTH * 0.5, HEIGHT * 0.44, WIDTH * 0.25, motif, 0.6);
      rect(canvas, 0, HEIGHT * 0.68, WIDTH, 2, motif, 0.6);
      rect(canvas, 0, HEIGHT * 0.73, WIDTH, 1, motif, 0.3);
      break;
    case 3: {
      // Ses dalgası benzeri yatay barlar
      for (let i = 0; i < 7; i++) {
        const w = WIDTH * (0.2 + ((hash >>> (i * 3 + 2)) % 10) / 16);
        rect(
          canvas,
          WIDTH * 0.15,
          HEIGHT * (0.34 + i * 0.048),
          w,
          5,
          motif,
          0.55,
        );
      }
      break;
    }
    default:
      // İç içe geçmiş iki daire
      circle(canvas, WIDTH * 0.34, HEIGHT * 0.44, WIDTH * 0.19, motif, 0.35);
      ring(canvas, WIDTH * 0.62, HEIGHT * 0.58, WIDTH * 0.22, 3, motif, 0.7);
      break;
  }

  // 4) Sol kenarda film şeridi perforasyonu — sinema kimliği
  rect(canvas, 0, 0, WIDTH * 0.075, HEIGHT, INK, 0.45);
  const holeH = HEIGHT * 0.028;
  for (let y = HEIGHT * 0.02; y < HEIGHT - holeH; y += HEIGHT * 0.062) {
    rect(canvas, WIDTH * 0.022, y, WIDTH * 0.031, holeH, LIGHT, 0.5);
  }

  // 5) Vinyet — kenarları koyulaştırıp posteri çerçeveler
  vignette(canvas, 0.26);

  return encodePng(WIDTH, HEIGHT, canvas.data);
}

async function ensureBucket() {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw error;
  if (buckets.some((b) => b.id === BUCKET)) return;
  const { error: createError } = await admin.storage.createBucket(BUCKET, {
    public: true,
  });
  if (createError) throw createError;
  console.log(`'${BUCKET}' bucket'ı oluşturuldu (public).`);
}

async function main() {
  await ensureBucket();

  const { data: films, error } = await admin
    .from("films")
    .select("id, slug, original_title, poster_path");
  if (error) throw error;
  if (!films.length) {
    console.error("Film kataloğu boş — önce tmdb-sync çalıştırılmalı.");
    process.exit(1);
  }

  let generated = 0;
  let skipped = 0;
  for (const film of films) {
    // Gerçek bir TMDB yolu varsa (anahtar tanımlıysa tmdb-sync doldurur) dokunma.
    if (film.poster_path && !film.poster_path.includes(`/${BUCKET}/`)) {
      skipped += 1;
      continue;
    }

    const path = `posters/${film.slug}.png`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, poster(film.slug), {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) {
      console.warn(`Yüklenemedi (${film.slug}):`, uploadError.message);
      continue;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    const { error: updateError } = await admin
      .from("films")
      .update({ poster_path: publicUrl })
      .eq("id", film.id);
    if (updateError) {
      console.warn(
        `poster_path güncellenemedi (${film.slug}):`,
        updateError.message,
      );
      continue;
    }
    generated += 1;
  }

  console.log(
    `Tamamlandı: ${generated} poster üretildi, ${skipped} film gerçek TMDB posterine sahip olduğu için atlandı.`,
  );
}

main().catch((error) => {
  console.error("film-art betiği başarısız oldu:", error);
  process.exit(1);
});
