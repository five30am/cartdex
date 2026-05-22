#!/usr/bin/env python3
"""
Build the reference grid artifact.
Since we can't download actual photographs (no direct image download),
we generate a reference card per system showing:
 - System name
 - Key reference data used (hardware specs from research)
 - Color swatches of the dominant hardware colors
 - The 64px v3 icon we produced

This serves as a paper trail of what visual reference guided each icon.
"""

from PIL import Image, ImageDraw, ImageFont
import os

REFS_DIR = "/home/claude/projects/DOCS/Projects/cartdex/icon-refs"
ICONS_DIR = "/home/claude/projects/cartdex/public/icons/systems"
os.makedirs(REFS_DIR, exist_ok=True)

# Reference data per system (what we researched)
REFERENCE_DATA = {
    "nes": {
        "name": "Nintendo Entertainment System",
        "ref": "Controller: rectangular grey brick\n5:2.5 ratio, charcoal grey body\nD-pad left, A/B red circles right\nSELECT/START small ovals center",
        "colors": [(110,110,115), (195,30,35), (30,30,33), (70,70,74)],
        "labels": ["Body grey", "A/B red", "D-pad", "Buttons"],
    },
    "snes": {
        "name": "Super Nintendo Entertainment System",
        "ref": "Controller: rounded purple-grey\nY=green, A=red, X=blue, B=yellow (JP/EU)\nL/R shoulder tabs at top\nGrip bumps at bottom corners",
        "colors": [(140,135,168), (60,160,70), (195,45,45), (55,100,195), (215,185,35)],
        "labels": ["Body", "Y grn", "A red", "X blu", "B yel"],
    },
    "n64": {
        "name": "Nintendo 64",
        "ref": "Controller: trident/3-prong\nGrey body, blue analog stick center\nYellow C-buttons (4x) right prong\nGreen B left, Blue A right, Red START center",
        "colors": [(140,140,140), (55,90,185), (220,185,30), (195,30,35), (55,160,65), (45,85,195)],
        "labels": ["Body", "Analog", "C-btns", "START", "B btn", "A btn"],
    },
    "gb": {
        "name": "Game Boy (DMG-01)",
        "ref": "Handheld: vertical portrait, grey\n2.5\" green-tinted LCD upper\nD-pad lower-left, A/B lower-right\nVertical speaker slits bottom-right\nPower LED top-left",
        "colors": [(176,176,168), (130,152,90), (45,45,42), (160,40,45)],
        "labels": ["Body", "Screen", "D-pad", "A/B"],
    },
    "gbc": {
        "name": "Game Boy Color (Atomic Purple)",
        "ref": "Handheld: taller portrait\nTranslucent purple (#7A58A5)\nCircular speaker grille top-right\nIR port top center\nA/B smaller red buttons",
        "colors": [(122,88,165), (138,100,185), (55,38,75), (200,45,55)],
        "labels": ["Purple", "Highlight", "Screen", "A/B"],
    },
    "gba": {
        "name": "Game Boy Advance (Indigo)",
        "ref": "Handheld: landscape 144.5x82mm\nIndigo (#4B46A0) body\nScreen centered (2.9\" diagonal)\nL/R shoulder tabs top edges\nNo analog stick (original GBA)",
        "colors": [(75,70,155), (60,56,135), (88,108,65), (195,35,40)],
        "labels": ["Body", "Shoulder", "Screen", "A/B"],
    },
    "genesis": {
        "name": "Sega Genesis 6-Button (MK-1653)",
        "ref": "Controller: black, rounded\n6 face buttons: X/Y/Z top row, A/B/C bottom\nD-pad left, START oval upper center\nMODE small button right edge\nMore rounded than original 3-btn",
        "colors": [(35,35,38), (42,42,46), (18,18,20), (55,55,62)],
        "labels": ["Body", "Face", "D-pad", "Buttons"],
    },
    "mastersystem": {
        "name": "Sega Master System",
        "ref": "Controller: near-black, angular\nButton 1 + Button 2: red circles right\nD-pad left, square Sega cross style\nNo START on controller (console-mounted)\nAngular body, less round than NES",
        "colors": [(28,28,32), (35,35,40), (185,28,33), (20,20,24)],
        "labels": ["Body", "Face", "Btn 1/2", "D-pad"],
    },
    "arcade": {
        "name": "JAMMA Upright Arcade Cabinet",
        "ref": "Cabinet: upright ~6ft tall\nMarquee: backlit colored band (red)\nCRT monitor mid-center, slight recess\nControl panel: angled, joystick + 6 buttons\nCoin door bottom panel\nBlack/dark wood body",
        "colors": [(38,38,42), (190,28,32), (28,55,95), (185,30,35), (35,145,60), (40,80,185)],
        "labels": ["Body", "Marquee", "Screen", "Btn R", "Btn G", "Btn B"],
    },
    "psx": {
        "name": "PlayStation (SCPH-1080)",
        "ref": "Controller: light warm grey dual-grip\nNo analog sticks (pre-DualShock)\nTriangle=green, Circle=red, Cross=blue, Square=pink\nL1/R1 shoulder buttons top\nSELECT/START center small",
        "colors": [(185,185,188), (55,165,85), (195,40,45), (65,95,195), (195,70,165)],
        "labels": ["Body", "Triangle", "Circle", "Cross", "Square"],
    },
    "psp": {
        "name": "PSP-1000 (Piano Black)",
        "ref": "Handheld: landscape widescreen\nPiano black (#1A1A20)\nUMD widescreen 4.3\" display\nAnalog nub lower-left (small rubber nub)\nFace buttons: same as PS colors\nL/R shoulder tabs top",
        "colors": [(26,26,32), (32,32,38), (18,42,88), (55,165,85), (195,40,45)],
        "labels": ["Body", "Face", "Screen", "Triangle", "Circle"],
    },
}

SYSTEMS = ["nes", "snes", "n64", "gb", "gbc", "gba", "genesis", "mastersystem", "arcade", "psx", "psp"]

# Grid layout: 4 columns
COLS = 4
ROWS = (len(SYSTEMS) + COLS - 1) // COLS

CARD_W = 320
CARD_H = 200
PADDING = 16
GRID_W = COLS * CARD_W + (COLS + 1) * PADDING
GRID_H = ROWS * CARD_H + (ROWS + 1) * PADDING + 60  # header

grid = Image.new("RGBA", (GRID_W, GRID_H), (24, 24, 28, 255))
gd = ImageDraw.Draw(grid)

# Header
gd.rectangle([0, 0, GRID_W, 60], fill=(35, 35, 42))
gd.text((PADDING, 12), "CartDex System Icons v3 — Reference Grid", fill=(240, 240, 245))
gd.text((PADDING, 36), "Source: Web search + Wikipedia hardware specs. Color/layout data for each system.", fill=(160, 160, 175))

# Try to load a font
try:
    font_lg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
    font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
    font_xs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 8)
except Exception:
    font_lg = font_sm = font_xs = None

for idx, slug in enumerate(SYSTEMS):
    col = idx % COLS
    row = idx // COLS
    cx = PADDING + col * (CARD_W + PADDING)
    cy = 60 + PADDING + row * (CARD_H + PADDING)

    data = REFERENCE_DATA[slug]

    # Card background
    gd.rounded_rectangle([cx, cy, cx + CARD_W, cy + CARD_H], radius=6,
                          fill=(38, 38, 46), outline=(60, 60, 72))

    # System name header
    gd.rectangle([cx, cy, cx + CARD_W, cy + 24], fill=(52, 52, 65))
    gd.text((cx + 8, cy + 5), data["name"], fill=(240, 240, 248), font=font_sm)

    # Load 64px icon
    icon_path = os.path.join(ICONS_DIR, f"{slug}-64.png")
    icon = Image.open(icon_path).convert("RGBA")
    # Place icon on right side of card
    icon_x = cx + CARD_W - 80
    icon_y = cy + 28
    # Dark background for icon
    gd.rectangle([icon_x - 4, icon_y - 4, icon_x + 68, icon_y + 68], fill=(28, 28, 35))
    grid.paste(icon, (icon_x, icon_y), icon)

    # Reference notes
    ref_lines = data["ref"].split("\n")
    for li, line in enumerate(ref_lines[:4]):
        gd.text((cx + 8, cy + 28 + li * 14), line, fill=(180, 180, 195), font=font_xs)

    # Color swatches
    swatch_y = cy + CARD_H - 38
    gd.text((cx + 8, swatch_y - 14), "Reference colors:", fill=(130, 130, 150), font=font_xs)
    for si, color in enumerate(data["colors"][:6]):
        sx = cx + 8 + si * 44
        sy = swatch_y
        gd.rectangle([sx, sy, sx + 38, sy + 16], fill=color, outline=(200, 200, 210))
        label = data["labels"][si] if si < len(data["labels"]) else ""
        gd.text((sx, sy + 18), label[:6], fill=(140, 140, 160), font=font_xs)

out_path = os.path.join(REFS_DIR, "reference-grid.png")
grid.save(out_path, "PNG")
print(f"Reference grid saved: {out_path}")
print(f"Size: {grid.size}")
