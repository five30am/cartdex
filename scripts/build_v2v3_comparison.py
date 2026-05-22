#!/usr/bin/env python3
"""
Build v2-vs-v3 side-by-side comparison.
Shows each system: system name | v2 32px | v2 64px | v3 32px | v3 64px | what changed
"""

from PIL import Image, ImageDraw, ImageFont
import os

V2_DIR = "/home/claude/projects/cartdex/public/icons/systems/v2-archive"
V3_DIR = "/home/claude/projects/cartdex/public/icons/systems"
OUT_PATH = "/home/claude/projects/DOCS/Projects/cartdex/icon-v2-v3-comparison.png"

SYSTEMS = ["nes", "snes", "n64", "gb", "gbc", "gba", "genesis", "mastersystem", "arcade", "psx", "psp"]

CHANGES = {
    "nes": "Body aspect ratio corrected (wider). D-pad is true cross. A/B now separate red circles right-side. SELECT/START as twin ovals.",
    "snes": "Rounded corners + grip bumps match actual pad shape. JP/EU button colors: Y=green, A=red, X=blue, B=yellow. L/R shoulder tabs added.",
    "n64": "True trident 3-prong shape. Blue analog stick center prong. Yellow C-buttons x4 right prong. Green B, Blue A, Red START correctly placed.",
    "gb": "Correct portrait proportions. Green-tinted LCD (DMG has greenish screen). Red power LED. Vertical speaker slits bottom-right (not round holes).",
    "gbc": "Atomic Purple translucent feel. Distinctive circular speaker grille top-right (key GBC identifier). IR port nub at top center.",
    "gba": "Landscape orientation (was portrait-ish). Indigo color. Screen centered. L/R shoulder tabs top-edges. No analog stick on original GBA.",
    "genesis": "6-button layout: top row X/Y/Z + bottom row A/B/C. START as large oval center-top. Rounded ergonomic body. MODE button right edge.",
    "mastersystem": "Correct angular Sega body shape. Two red circle buttons (Button 1/2) staggered right. No START (it's on console). Near-black body.",
    "arcade": "Cabinet silhouette: marquee, CRT with scanlines, angled control panel, joystick + 6 colored buttons, coin door. Full upright form.",
    "psx": "Light warm grey dual-grip body. Pre-DualShock (no analog sticks). Triangle=green, Circle=red, Cross=blue, Square=pink correctly colored.",
    "psp": "Piano black landscape. Analog nub (small rubber nub, PSP distinctive). Widescreen UMD-shaped display. PlayStation face button colors.",
}

try:
    font_hdr = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    font_sm  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
    font_xs  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9)
    font_col = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 11)
except Exception:
    font_hdr = font_sm = font_xs = font_col = None

ROW_H = 90
LABEL_W = 110
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
d.text((MARGIN, 10), "CartDex System Icons — v2 vs v3 Comparison", fill=(245, 245, 252), font=font_hdr)
d.text((MARGIN, 32), "Left pair = v2 (memory-only). Right pair = v3 (reference-grounded). | 32px + 64px shown.", fill=(160, 160, 180), font=font_sm)

# Column headers
col_y = HEADER_H + 8
d.text((MARGIN, col_y), "System", fill=(200, 200, 215), font=font_col)
d.text((MARGIN + LABEL_W, col_y), "v2 32", fill=(180, 100, 100), font=font_col)
d.text((MARGIN + LABEL_W + ICON32_W, col_y), "v2 64", fill=(180, 100, 100), font=font_col)
d.text((MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W, col_y), "v3 32", fill=(80, 180, 100), font=font_col)
d.text((MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W + ICON32_W, col_y), "v3 64", fill=(80, 180, 100), font=font_col)
d.text((MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W + ICON32_W + ICON64_W + MARGIN, col_y),
       "What changed v2 → v3", fill=(200, 200, 215), font=font_col)

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

    # v2 32px
    v2_32 = Image.open(os.path.join(V2_DIR, f"{slug}-32.png")).convert("RGBA")
    v2_32_x = MARGIN + LABEL_W + (ICON32_W - 32) // 2
    img.paste(v2_32, (v2_32_x, icon_center_y + 16), v2_32)

    # v2 64px
    v2_64 = Image.open(os.path.join(V2_DIR, f"{slug}-64.png")).convert("RGBA")
    v2_64_x = MARGIN + LABEL_W + ICON32_W + (ICON64_W - 64) // 2
    img.paste(v2_64, (v2_64_x, icon_center_y), v2_64)

    # Divider between v2 and v3
    sep_x = MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W // 2
    d.line([sep_x, row_y + 4, sep_x, row_y + ROW_H - 4], fill=(60, 60, 80), width=2)

    # v3 32px
    v3_32 = Image.open(os.path.join(V3_DIR, f"{slug}-32.png")).convert("RGBA")
    v3_32_x = MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W + (ICON32_W - 32) // 2
    img.paste(v3_32, (v3_32_x, icon_center_y + 16), v3_32)

    # v3 64px
    v3_64 = Image.open(os.path.join(V3_DIR, f"{slug}-64.png")).convert("RGBA")
    v3_64_x = MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W + ICON32_W + (ICON64_W - 64) // 2
    img.paste(v3_64, (v3_64_x, icon_center_y), v3_64)

    # Changes text (wrapped)
    change_x = MARGIN + LABEL_W + ICON32_W + ICON64_W + SEP_W + ICON32_W + ICON64_W + MARGIN
    change_text = CHANGES.get(slug, "")
    # Manual word wrap at ~65 chars
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
