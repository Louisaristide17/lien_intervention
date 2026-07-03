"""Génère toutes les icônes PWA pour TechIntervention."""
import os
from PIL import Image, ImageDraw, ImageFont

SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
OUT_DIR = os.path.join(os.path.dirname(__file__), 'icons')
os.makedirs(OUT_DIR, exist_ok=True)

def draw_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Fond bleu avec coins arrondis
    radius = int(size * 0.22)
    # Rectangle principal
    draw.rounded_rectangle([0, 0, size - 1, size - 1],
                            radius=radius,
                            fill=(21, 101, 192, 255))

    # Dégradé simulé : rectangle légèrement plus clair en haut
    draw.rounded_rectangle([0, 0, size - 1, size // 2],
                            radius=radius,
                            fill=(25, 118, 210, 255))

    # --- Clé à molette stylisée ---
    cx, cy = size / 2, size / 2
    s = size / 512  # facteur d'échelle

    lw = max(2, int(28 * s))  # épaisseur du trait

    # Corps diagonal de la clé
    x1, y1 = cx - 130 * s, cy + 130 * s
    x2, y2 = cx + 70 * s,  cy - 70 * s
    draw.line([x1, y1, x2, y2], fill='white', width=lw)

    # Tête (anneau)
    hx, hy = cx + 105 * s, cy - 105 * s
    hr = 68 * s
    draw.ellipse([hx - hr, hy - hr, hx + hr, hy + hr],
                 outline='white', width=lw)

    # Manche épais
    mx1, my1 = cx - 100 * s, cy + 100 * s
    mx2, my2 = cx - 148 * s, cy + 148 * s
    draw.line([mx1, my1, mx2, my2], fill=(255, 255, 255, 180), width=int(lw * 1.4))

    # Initiales "TI" centrées en bas
    font_size = max(8, int(size * 0.23))
    try:
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except Exception:
        try:
            font = ImageFont.truetype("Arial_Bold.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()

    text = "TI"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) / 2 - bbox[0]
    ty = size * 0.70 - bbox[1]
    draw.text((tx, ty), text, fill='white', font=font)

    return img

for size in SIZES:
    icon = draw_icon(size)
    path = os.path.join(OUT_DIR, f'icon-{size}.png')
    icon.save(path, 'PNG')
    print(f'✅ Icône {size}x{size} → {path}')

print('\n🎉 Toutes les icônes ont été générées dans le dossier icons/')
