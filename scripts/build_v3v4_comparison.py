#!/usr/bin/env python3
"""
Build v3-vs-v4 side-by-side comparison.
Shows each system: system name | v3 32px | v3 64px | v4 32px | v4 64px | what changed
"""

from PIL import Image, ImageDraw, ImageFont
import os

V3_DIR = "/home/claude/projects/cartdex/public/icons/systems/v3-archive"
V4_DIR = "/home/claude/projects/cartdex/public/icons/systems"
OUT_PATH = "/home/claude/projects/DOCS/Projects/cartdex/icon-v3-v4-comparison.png"

SYSTEMS = ["nes", "snes", "n64", "gb", "gbc", "gba", "genesis", "mastersystem", "arcade", "psx", "psp"]

CHANGES = {
    "nes":          "Color/line: dropped inner faceplate layer, single flat body, near-black outline, saturated red A/B buttons.",
    "snes":         "Color/line: removed graduated inner face, harder outline, full-saturation JP/EU button colors.",
    "n64":          "GEOMETRY + color: flat top edge (was domed), grey analog stick (was blue), START above stick (was below), harder outlines.",
    "gb":           "Color/line: single body fill, crisper outline, deeper red buttons, removed soft screen glare line.",
    "gbc":          "Color/line: flattened double-highlight body to single saturated purple, pushed red buttons brighter.",
    "gba":          "Color/line: single flat indigo body, hard outline on shoulder tabs, brighter red A/B.",
    "genesis":      "Color/line: removed inner faceplate highlight, single near-black body, stronger outline contrast.",
    "mastersystem": "Color/line: dropped inner faceplate layer, single black body, saturated red buttons, harder outlines.",
    "arcade":       "Color/line: removed scanline bands (added softness), saturated RGB buttons, flat screen fill.",
    "psx":          "Color/line: single body fill (dropped inner highlight), pushed all 4 face button colors to full saturation.",
    "psp":          "Color/line: single piano-black body, flat screen, saturated face buttons, removed screen highlight line.",
}

try:
    font_hdr = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    font_sm  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
    font_xs  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9)
    font_col = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 11)
except Exception:
    font_hdr = font_sm = font_xs = font_col = None

ROW_H = 90
LABEL_W = 115
ICON32_W = 50
ICON64_W = 80
SEP_W = 10
CHANGE_W = 460
MARGIN = 12

TOTAL_W = MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W + ICON32_W + ICON64_W + MARGIN + CHANGE_W + MARGIN
HEADER_H = 56
TOTAL_H = HEADER_H + len(SYSTEMS) * ROW_H + MARGIN

img = Image.new("RGBA", (TOTAL_W, TOTAL_H), (20, 20, 26, 255))
d = ImageDraw.Draw(img)

# Header
d.rectangle([0, 0, TOTAL_W, HEADER_H], fill=(30, 30, 40))
d.text((MARGIN, 10), "CartDex System Icons — v3 vs v4 Comparison", fill=(245, 245, 252), font=font_hdr)
d.text((MARGIN, 32), "Left pair = v3 (reference shapes, soft). Right pair = v4 (v3 shapes + v2 color/line discipline, N64 geometry fixed).", fill=(160, 160, 180), font=font_sm)

# Column headers
col_y = HEADER_H + 8
d.text((MARGIN, col_y), "System", fill=(200, 200, 215), font=font_col)
d.text((MARGIN + LABEL_W, col_y), "v3 32", fill=(180, 100, 100), font=font_col)
d.text((MARGIN + LABEL_W + ICON32_W, col_y), "v3 64", fill=(180, 100, 100), font=font_col)
d.text((MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W, col_y), "v4 32", fill=(80, 180, 100), font=font_col)
d.text((MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W + ICON32_W, col_y), "v4 64", fill=(80, 180, 100), font=font_col)
d.text((MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W + ICON32_W + ICON64_W + MARGIN, col_y),
       "What changed v3 -> v4", fill=(200, 200, 215), font=font_col)

for idx, slug in enumerate(SYSTEMS):
    row_y = HEADER_H + 28 + idx * ROW_H

    # Alternating row bg
    if idx % 2 == 0:
        d.rectangle([0, row_y, TOTAL_W, row_y + ROW_H], fill=(26, 26, 34))
    else:
        d.rectangle([0, row_y, TOTAL_W, row_y + ROW_H], fill=(22, 22, 30))

    # System label
    d.text((MARGIN, row_y + 8), slug.upper(), fill=(220, 220, 235), font=font_col)

    icon_center_y = row_y + (ROW_H - 64) // 2

    # v3 32px
    v3_32 = Image.open(os.path.join(V3_DIR, f"{slug}-32.png")).convert("RGBA")
    v3_32_x = MARGIN + LABEL_W + (ICON32_W - 32) // 2
    img.paste(v3_32, (v3_32_x, icon_center_y + 16), v3_32)

    # v3 64px
    v3_64 = Image.open(os.path.join(V3_DIR, f"{slug}-64.png")).convert("RGBA")
    v3_64_x = MARGIN + LABEL_W + ICON32_W + (ICON64_W - 64) // 2
    img.paste(v3_64, (v3_64_x, icon_center_y), v3_64)

    # Divider between v3 and v4
    sep_x = MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W // 2
    d.line([sep_x, row_y + 4, sep_x, row_y + ROW_H - 4], fill=(60, 60, 80), width=2)

    # v4 32px
    v4_32 = Image.open(os.path.join(V4_DIR, f"{slug}-32.png")).convert("RGBA")
    v4_32_x = MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W + (ICON32_W - 32) // 2
    img.paste(v4_32, (v4_32_x, icon_center_y + 16), v4_32)

    # v4 64px
    v4_64 = Image.open(os.path.join(V4_DIR, f"{slug}-64.png")).convert("RGBA")
    v4_64_x = MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W + ICON32_W + (ICON64_W - 64) // 2
    img.paste(v4_64, (v4_64_x, icon_center_y), v4_64)

    # Changes text (wrapped)
    change_x = MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W + ICON32_W + ICON64_W + MARGIN
    change_text = CHANGES.get(slug, "")
    words = change_text.split()
    lines = []
    current = ""
    for word in words:
        if len(current) + len(word) + 1 <= 62:
            current = (current + " " + word).strip()
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)

    for li, line in enumerate(lines[:5]):
        d.text((change_x, row_y + 8 + li * 14), line, fill=(195, 200, 215), font=font_xs)

img.save(OUT_PATH, "PNG")
print(f"Comparison saved: {OUT_PATH}")
print(f"Size: {img.size}")
