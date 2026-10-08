#!/usr/bin/env python3
"""
Movieholix uygulama ikonlarını marka işaretinden üretir.

İşaret, tanıtım sitesindekiyle (apps/landing/public/index.html) aynı: koyu
zemin üzerinde sarı halka ve pembe merkez noktası. Oranlar oradaki SVG'den
birebir korunuyor — halka yarıçapı / nokta yarıçapı = 3.75, çizgi kalınlığı =
halka yarıçapının 1/3'ü.

Renkler packages/tokens/src/raw.cjs'ten (PRD 15.2 "Gece seansı"):
  ink #1B2440 · popcorn #FFC23D · ticket #F2547D

Çalıştırma:  python3 apps/mobile/scripts/generate-icons.py
"""

from pathlib import Path
from PIL import Image, ImageDraw

INK = (0x1B, 0x24, 0x40, 255)
POPCORN = (0xFF, 0xC2, 0x3D, 255)
TICKET = (0xF2, 0x54, 0x7D, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

SS = 4  # süper örnekleme (kenar yumuşatma için)

ASSETS = Path(__file__).resolve().parent.parent / "assets" / "images"


def draw_mark(size: int, ring_r_frac: float, bg, ring, dot) -> Image.Image:
    """Halka + nokta işaretini çizer. ring_r_frac: halka yarıçapı / kenar."""
    s = size * SS
    img = Image.new("RGBA", (s, s), bg)
    d = ImageDraw.Draw(img)

    c = s / 2
    ring_r = s * ring_r_frac
    stroke = ring_r / 3.0          # SVG'de 2.5 / 7.5
    dot_r = ring_r / 3.75          # SVG'de 2 / 7.5

    d.ellipse(
        [c - ring_r, c - ring_r, c + ring_r, c + ring_r],
        outline=ring,
        width=round(stroke),
    )
    d.ellipse([c - dot_r, c - dot_r, c + dot_r, c + dot_r], fill=dot)

    return img.resize((size, size), Image.LANCZOS)


def save(img: Image.Image, name: str) -> None:
    path = ASSETS / name
    img.save(path, "PNG")
    print(f"  {name}  {img.size[0]}x{img.size[1]}")


def main() -> None:
    print("Movieholix ikonları üretiliyor:")

    # iOS / genel ikon: tam kare, köşeleri işletim sistemi yuvarlıyor.
    save(draw_mark(1024, 0.30, INK, POPCORN, TICKET), "icon.png")

    # Android adaptive: ön plan içeriği merkezdeki güvenli alanda kalmalı,
    # bu yüzden işaret daha küçük çiziliyor.
    save(Image.new("RGBA", (512, 512), INK), "android-icon-background.png")
    save(draw_mark(512, 0.20, CLEAR, POPCORN, TICKET), "android-icon-foreground.png")
    # Temalı ikon: tek renk siluet.
    save(draw_mark(432, 0.20, CLEAR, WHITE, WHITE), "android-icon-monochrome.png")

    # Splash: saydam zemin (app.json backgroundColor veriyor).
    save(draw_mark(512, 0.30, CLEAR, POPCORN, TICKET), "splash-icon.png")

    # Favicon.
    save(draw_mark(48, 0.30, INK, POPCORN, TICKET), "favicon.png")


if __name__ == "__main__":
    main()
