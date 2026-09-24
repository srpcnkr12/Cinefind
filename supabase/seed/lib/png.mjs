// Bağımlılıksız, küçük bir RGB PNG kodlayıcı + birkaç çizim ilkeli.
// Demo/staging seed betikleri (film posteri, avatar) bunu paylaşır; üretimde
// kullanılmaz. Harici bir görsel kütüphanesi (sharp/canvas) eklememek için
// piksel tamponu elle dolduruluyor.

import zlib from "node:zlib";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** w*h*3 RGB tamponunu geçerli bir PNG dosyasına çevirir. */
export function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 2; // renk tipi: RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0; // filtre: yok
    rgb.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function createCanvas(width, height) {
  return { width, height, data: Buffer.alloc(width * height * 3) };
}

export function hexToRgb(hex) {
  const v = hex.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

export function mix(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

/** Var olan pikselin üstüne `alpha` yoğunluğunda renk karıştırır. */
export function blend(canvas, x, y, color, alpha) {
  if (alpha <= 0 || x < 0 || y < 0 || x >= canvas.width || y >= canvas.height)
    return;
  const i = (y * canvas.width + x) * 3;
  const a = Math.min(1, alpha);
  canvas.data[i] = Math.round(canvas.data[i] * (1 - a) + color[0] * a);
  canvas.data[i + 1] = Math.round(canvas.data[i + 1] * (1 - a) + color[1] * a);
  canvas.data[i + 2] = Math.round(canvas.data[i + 2] * (1 - a) + color[2] * a);
}

/** Her piksel için (x, y) -> [r,g,b] veren fonksiyonla tüm tuvali doldurur. */
export function fill(canvas, shade) {
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const c = shade(x, y);
      const i = (y * canvas.width + x) * 3;
      canvas.data[i] = c[0];
      canvas.data[i + 1] = c[1];
      canvas.data[i + 2] = c[2];
    }
  }
}

/** Yumuşak kenarlı dolu daire. */
export function circle(
  canvas,
  cx,
  cy,
  radius,
  color,
  alpha = 1,
  feather = 1.5,
) {
  const x0 = Math.max(0, Math.floor(cx - radius - feather));
  const x1 = Math.min(canvas.width - 1, Math.ceil(cx + radius + feather));
  const y0 = Math.max(0, Math.floor(cy - radius - feather));
  const y1 = Math.min(canvas.height - 1, Math.ceil(cy + radius + feather));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const edge = Math.max(
        0,
        Math.min(1, (radius + feather - d) / (2 * feather)),
      );
      blend(canvas, x, y, color, alpha * edge);
    }
  }
}

/** Yumuşak kenarlı halka (dolu olmayan daire). */
export function ring(canvas, cx, cy, radius, thickness, color, alpha = 1) {
  const outer = radius + thickness / 2;
  const inner = radius - thickness / 2;
  const x0 = Math.max(0, Math.floor(cx - outer - 2));
  const x1 = Math.min(canvas.width - 1, Math.ceil(cx + outer + 2));
  const y0 = Math.max(0, Math.floor(cy - outer - 2));
  const y1 = Math.min(canvas.height - 1, Math.ceil(cy + outer + 2));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const edge = Math.max(
        0,
        Math.min(1, Math.min(outer - d, d - inner) / 1.5),
      );
      blend(canvas, x, y, color, alpha * edge);
    }
  }
}

export function rect(canvas, x0, y0, w, h, color, alpha = 1) {
  for (
    let y = Math.max(0, Math.round(y0));
    y < Math.min(canvas.height, Math.round(y0 + h));
    y++
  ) {
    for (
      let x = Math.max(0, Math.round(x0));
      x < Math.min(canvas.width, Math.round(x0 + w));
      x++
    ) {
      blend(canvas, x, y, color, alpha);
    }
  }
}

/** Radyal ışık/parlama — merkeze yakın yoğun, kenara doğru sönümlenen. */
export function glow(canvas, cx, cy, radius, color, intensity) {
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= radius) continue;
      const falloff = (1 - d / radius) ** 2;
      blend(canvas, x, y, color, intensity * falloff);
    }
  }
}

/** Kenarlara doğru koyulaşan vinyet. */
export function vignette(canvas, strength = 0.35) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const max = Math.hypot(cx, cy);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const t = Math.hypot(x - cx, y - cy) / max;
      blend(canvas, x, y, [0, 0, 0], strength * t * t);
    }
  }
}

/** Girdi dizesinden deterministik 32-bit hash (aynı film hep aynı görseli alır). */
export function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Hash'ten türeyen, tekrarlanabilir sözde-rastgele üreteç. */
export function seededRandom(seed) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
