#!/usr/bin/env python3
"""
CartDex System Icons v3 - Reference-grounded pixel art
Generated from real controller/console reference research.

Each icon is drawn from documented hardware specs:
- NES: rectangular grey brick, D-pad left, A/B red circles right, SELECT/START oval middle
- SNES: rounded purple-grey, D-pad, Y/X/B/A diamond (SNES NA: purple buttons; JP: colored)
- N64: trident/3-prong shape, blue analog stick center, yellow C-buttons, red Start, blue A, green B
- GB: vertical, grey body, green-tinted LCD top, D-pad lower-left, A/B lower-right, speaker right
- GBC: taller portrait, translucent purple, circular speaker grille top-right, single speaker dot grid
- GBA: landscape 5:3 ratio, indigo, screen center, D-pad left, A/B right, L/R shoulder tabs
- Genesis: 6-button black controller, D-pad left, 3 buttons top (X/Y/Z), 3 buttons bottom (A/B/C)
- Master System: black rectangle, D-pad left, 2 red round buttons right, small body
- Arcade: upright cabinet silhouette, marquee top, screen mid, joystick+buttons on panel
- PSX: grey dual-grip controller, 4 face buttons (green triangle, red circle, blue cross, pink square)
- PSP: landscape widescreen, black, D-pad left of screen, face buttons right, analog nub lower-left
"""

from PIL import Image, ImageDraw
import os

OUT_DIR = "/home/claude/projects/cartdex/public/icons/systems"
os.makedirs(OUT_DIR, exist_ok=True)

def make_canvas(size):
    """Transparent RGBA canvas."""
    return Image.new("RGBA", (size, size), (0, 0, 0, 0))

def save(img, name, size):
    path = os.path.join(OUT_DIR, f"{name}-{size}.png")
    img.save(path, "PNG")
    print(f"  saved {path}")

def aa_outline(draw, xy, fill, outline, radius=2):
    """Rounded rect helper."""
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline)

def draw_dpad(draw, cx, cy, arm_w, arm_h, color, outline_color=None):
    """Draw a plus-sign D-pad centered at cx,cy."""
    oc = outline_color or color
    # Horizontal bar
    draw.rectangle([cx - arm_h, cy - arm_w, cx + arm_h, cy + arm_w], fill=color, outline=oc)
    # Vertical bar
    draw.rectangle([cx - arm_w, cy - arm_h, cx + arm_w, cy + arm_h], fill=color, outline=oc)
    # Center square
    draw.rectangle([cx - arm_w, cy - arm_w, cx + arm_w, cy + arm_w], fill=color)

def circle(draw, cx, cy, r, fill, outline=None):
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=fill, outline=outline)


# ─────────────────────────────────────────────
# NES - Reference: Rectangular grey brick controller
# Body: ~5:2.5 ratio rectangle, charcoal grey (#6E6E73)
# D-pad: left side, black cross
# A/B: two red circles, right side
# SELECT/START: two oval buttons, center-right area
# Cable port nub at top-center
# ─────────────────────────────────────────────
def draw_nes(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64  # scale factor

    # Body - charcoal grey, slightly wider than tall
    bx1, by1 = int(4*s), int(16*s)
    bx2, by2 = int(60*s), int(50*s)
    d.rounded_rectangle([bx1, by1, bx2, by2], radius=int(4*s),
                         fill=(110, 110, 115), outline=(50, 50, 54))

    # Inner face plate - slightly different grey
    fx1, fy1 = int(6*s), int(18*s)
    fx2, fy2 = int(58*s), int(48*s)
    d.rounded_rectangle([fx1, fy1, fx2, fy2], radius=int(3*s),
                         fill=(95, 95, 100), outline=(70, 70, 75))

    # D-pad - left side, black
    dcx, dcy = int(17*s), int(33*s)
    dw = int(3*s)
    dh = int(7*s)
    draw_dpad(d, dcx, dcy, dw, dh, (30, 30, 33), (15, 15, 17))

    # SELECT button - small oval, center-left area
    sel_cx, sel_cy = int(30*s), int(36*s)
    sel_rx, sel_ry = int(4*s), int(2*s)
    d.ellipse([sel_cx - sel_rx, sel_cy - sel_ry,
               sel_cx + sel_rx, sel_cy + sel_ry],
              fill=(70, 70, 74), outline=(40, 40, 43))

    # START button - small oval, right of SELECT
    sta_cx = int(39*s)
    d.ellipse([sta_cx - sel_rx, sel_cy - sel_ry,
               sta_cx + sel_rx, sel_cy + sel_ry],
              fill=(70, 70, 74), outline=(40, 40, 43))

    # B button - red circle, right side
    b_cx, b_cy = int(46*s), int(36*s)
    b_r = int(4*s)
    circle(d, b_cx, b_cy, b_r, (195, 30, 35), (130, 15, 18))

    # A button - red circle, further right
    a_cx = int(53*s)
    circle(d, a_cx, b_cy, b_r, (195, 30, 35), (130, 15, 18))

    # Button labels (tiny at 64px, skip at 32px)
    if size >= 64:
        from PIL import ImageFont
        try:
            # Just add small highlights on A/B
            circle(d, b_cx - int(1*s), b_cy - int(1*s), int(1*s), (220, 60, 65))
            circle(d, a_cx - int(1*s), b_cy - int(1*s), int(1*s), (220, 60, 65))
        except Exception:
            pass

    # Connector nub top center
    nc = int(32*s)
    d.rectangle([nc - int(4*s), int(13*s), nc + int(4*s), int(16*s)],
                fill=(80, 80, 85))

    save(img, "nes", size)


# ─────────────────────────────────────────────
# SNES - Reference: Rounded purple-grey controller
# Body: wider, rounded edges, purple-grey (#8A8A9A)
# D-pad: left, black
# Face buttons: Y(left)/B(bottom)/A(right)/X(top) diamond
#   NA colors: all purple shades (convex/concave)
#   Going with JP/EU iconic colors: Y=green, B=yellow, A=red, X=blue
# SELECT/START: grey ovals, center
# L/R shoulder tabs visible at top
# ─────────────────────────────────────────────
def draw_snes(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Body - rounded purple-grey
    bx1, by1 = int(3*s), int(14*s)
    bx2, by2 = int(61*s), int(52*s)
    d.rounded_rectangle([bx1, by1, bx2, by2], radius=int(8*s),
                         fill=(140, 135, 168), outline=(90, 85, 110))

    # Left grip notch (rounded bottom-left bump)
    d.ellipse([int(3*s), int(44*s), int(18*s), int(56*s)],
              fill=(140, 135, 168), outline=(90, 85, 110))
    # Right grip notch
    d.ellipse([int(46*s), int(44*s), int(61*s), int(56*s)],
              fill=(140, 135, 168), outline=(90, 85, 110))

    # Inner face - slightly lighter
    d.rounded_rectangle([int(5*s), int(16*s), int(59*s), int(50*s)],
                         radius=int(6*s), fill=(155, 150, 182), outline=(115, 110, 140))

    # L shoulder button top-left
    d.rounded_rectangle([int(3*s), int(10*s), int(20*s), int(16*s)],
                         radius=int(3*s), fill=(120, 115, 148), outline=(80, 75, 100))
    # R shoulder button top-right
    d.rounded_rectangle([int(44*s), int(10*s), int(61*s), int(16*s)],
                         radius=int(3*s), fill=(120, 115, 148), outline=(80, 75, 100))

    # D-pad - left side
    dcx, dcy = int(19*s), int(33*s)
    dw, dh = int(3*s), int(8*s)
    draw_dpad(d, dcx, dcy, dw, dh, (40, 38, 50), (25, 23, 33))

    # SELECT - center-left oval
    d.ellipse([int(26*s), int(33*s), int(34*s), int(37*s)],
              fill=(100, 95, 120), outline=(70, 65, 88))
    # START - center-right oval
    d.ellipse([int(35*s), int(33*s), int(43*s), int(37*s)],
              fill=(100, 95, 120), outline=(70, 65, 88))

    # Face buttons diamond - SNES JP/EU colors
    btn_cx, btn_cy = int(48*s), int(31*s)
    btn_r = int(4*s)
    # Y (left) - green
    circle(d, btn_cx - int(7*s), btn_cy, btn_r, (60, 160, 70), (35, 110, 45))
    # A (right) - red
    circle(d, btn_cx + int(7*s), btn_cy, btn_r, (195, 45, 45), (140, 25, 25))
    # X (top) - blue
    circle(d, btn_cx, btn_cy - int(7*s), btn_r, (55, 100, 195), (35, 65, 145))
    # B (bottom) - yellow
    circle(d, btn_cx, btn_cy + int(7*s), btn_r, (215, 185, 35), (165, 140, 20))

    save(img, "snes", size)


# ─────────────────────────────────────────────
# N64 - Reference: Trident "W" shape controller
# 3 prongs: left (D-pad), center (analog stick), right (face buttons)
# Colors: grey body (#8C8C8C), blue analog stick, yellow C-buttons (4x),
#         green B, blue A, red Start in center
# Z trigger is underside - not visible from front
# ─────────────────────────────────────────────
def draw_n64(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    body_color = (140, 140, 140)
    body_outline = (85, 85, 88)

    # Left prong
    d.rounded_rectangle([int(2*s), int(18*s), int(22*s), int(46*s)],
                         radius=int(5*s), fill=body_color, outline=body_outline)
    # Center prong (taller)
    d.rounded_rectangle([int(22*s), int(14*s), int(42*s), int(50*s)],
                         radius=int(5*s), fill=body_color, outline=body_outline)
    # Right prong
    d.rounded_rectangle([int(42*s), int(18*s), int(62*s), int(46*s)],
                         radius=int(5*s), fill=body_color, outline=body_outline)
    # Connect body - horizontal bar
    d.rectangle([int(2*s), int(26*s), int(62*s), int(40*s)],
                fill=body_color)

    # D-pad on left prong
    dcx, dcy = int(12*s), int(30*s)
    draw_dpad(d, dcx, dcy, int(2*s), int(6*s), (45, 45, 48), (25, 25, 28))

    # Blue analog stick on center prong
    circle(d, int(32*s), int(27*s), int(5*s), (55, 90, 185), (35, 60, 145))
    # Stick nub highlight
    circle(d, int(31*s), int(26*s), int(2*s), (80, 120, 210))

    # Red START button center
    circle(d, int(32*s), int(40*s), int(3*s), (195, 30, 35), (140, 15, 18))

    # Yellow C-buttons on right prong (4 in diamond arrangement)
    ccx, ccy = int(52*s), int(28*s)
    cr = int(3*s)
    # C-up
    circle(d, ccx, ccy - int(5*s), cr, (220, 185, 30), (170, 140, 15))
    # C-down
    circle(d, ccx, ccy + int(5*s), cr, (220, 185, 30), (170, 140, 15))
    # C-left
    circle(d, ccx - int(5*s), ccy, cr, (220, 185, 30), (170, 140, 15))
    # C-right
    circle(d, ccx + int(5*s), ccy, cr, (220, 185, 30), (170, 140, 15))

    # Green B button - left prong upper
    circle(d, int(12*s), int(21*s), int(3*s), (55, 160, 65), (30, 110, 40))

    # Blue A button - right prong lower
    circle(d, int(52*s), int(40*s), int(4*s), (45, 85, 195), (25, 55, 145))

    # L shoulder - left top
    d.rounded_rectangle([int(2*s), int(13*s), int(20*s), int(18*s)],
                         radius=int(2*s), fill=(115, 115, 118), outline=(75, 75, 78))
    # R shoulder - right top
    d.rounded_rectangle([int(44*s), int(13*s), int(62*s), int(18*s)],
                         radius=int(2*s), fill=(115, 115, 118), outline=(75, 75, 78))

    save(img, "n64", size)


# ─────────────────────────────────────────────
# GB - Original Game Boy DMG-01
# Reference: Vertical grey brick, portrait orientation
# Body: medium grey (#B0B0A8), darker screen surround
# Screen: upper half, green-grey tinted (#7A8C4E area), with rounded corners
# "DOT MATRIX" text area above screen (just a dark band)
# D-pad: lower-left quadrant, black cross
# A/B: lower-right, dark red circles
# SELECT/START: small ovals, center below screen
# Speaker: vertical slits, bottom-right
# ─────────────────────────────────────────────
def draw_gb(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Body - medium grey
    d.rounded_rectangle([int(8*s), int(2*s), int(56*s), int(62*s)],
                         radius=int(6*s), fill=(176, 176, 168), outline=(120, 120, 114))

    # Screen area surround - darker grey
    d.rounded_rectangle([int(11*s), int(7*s), int(53*s), int(35*s)],
                         radius=int(3*s), fill=(80, 82, 78), outline=(55, 57, 53))

    # Actual screen - classic greenish LCD tint
    d.rounded_rectangle([int(15*s), int(10*s), int(49*s), int(32*s)],
                         radius=int(2*s), fill=(130, 152, 90), outline=(100, 120, 65))

    # Screen reflection/glare line
    d.line([int(17*s), int(11*s), int(30*s), int(11*s)],
           fill=(160, 185, 115), width=max(1, int(1*s)))

    # Power LED dot (top-left of body)
    circle(d, int(13*s), int(5*s), int(1*s), (220, 60, 60))

    # D-pad - lower left
    dcx, dcy = int(19*s), int(47*s)
    dw, dh = int(2*s), int(6*s)
    draw_dpad(d, dcx, dcy, dw, dh, (45, 45, 42), (25, 25, 23))

    # SELECT oval
    sel_cx, sel_cy = int(27*s), int(50*s)
    d.ellipse([sel_cx - int(4*s), sel_cy - int(2*s),
               sel_cx + int(4*s), sel_cy + int(2*s)],
              fill=(145, 145, 138), outline=(100, 100, 94))
    # START oval
    sta_cx = int(35*s)
    d.ellipse([sta_cx - int(4*s), sel_cy - int(2*s),
               sta_cx + int(4*s), sel_cy + int(2*s)],
              fill=(145, 145, 138), outline=(100, 100, 94))

    # B button - dark red circle
    b_cx, b_cy = int(41*s), int(46*s)
    br = int(4*s)
    circle(d, b_cx, b_cy, br, (160, 40, 45), (110, 20, 25))
    # A button
    a_cx = int(49*s)
    circle(d, a_cx, b_cy, br, (160, 40, 45), (110, 20, 25))

    # Speaker slits - bottom right vertical lines
    sx = int(43*s)
    for i in range(4):
        lx = sx + int(i * 2.5 * s)
        d.line([lx, int(54*s), lx, int(59*s)], fill=(100, 100, 95), width=max(1, int(1*s)))

    save(img, "gb", size)


# ─────────────────────────────────────────────
# GBC - Game Boy Color
# Reference: Taller than wide portrait, translucent purple (Atomic Purple)
# Body: translucent purple (#7A5CA0 with slight transparency feel)
# Screen: upper half, smaller proportionally than DMG
# Speaker: circular grid top-right (distinctive vs DMG's slits)
# D-pad: lower-left
# A/B: lower-right (smaller than DMG)
# SELECT/START: very small, center
# Rounded top with infrared port at top center
# ─────────────────────────────────────────────
def draw_gbc(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Body - translucent purple (simulate with semi-solid purple)
    d.rounded_rectangle([int(8*s), int(2*s), int(56*s), int(62*s)],
                         radius=int(8*s), fill=(122, 88, 165), outline=(80, 55, 115))

    # Lighter purple highlight on top half (translucency feel)
    d.rounded_rectangle([int(9*s), int(3*s), int(55*s), int(32*s)],
                         radius=int(7*s), fill=(138, 100, 185), outline=(100, 68, 138))

    # Screen surround
    d.rounded_rectangle([int(13*s), int(8*s), int(51*s), int(34*s)],
                         radius=int(3*s), fill=(55, 38, 75), outline=(35, 22, 52))

    # Screen - warmer tint than DMG
    d.rounded_rectangle([int(16*s), int(11*s), int(48*s), int(31*s)],
                         radius=int(2*s), fill=(145, 165, 100), outline=(110, 130, 72))

    # Infrared port - top center small dark nub
    d.ellipse([int(28*s), int(2*s), int(36*s), int(5*s)],
              fill=(45, 28, 65), outline=(25, 12, 40))

    # Speaker circular grille - top right of body
    # GBC has a distinctive round speaker hole grid
    spx, spy = int(44*s), int(19*s)
    spr = int(5*s)
    circle(d, spx, spy, spr, (65, 45, 88), (40, 25, 60))
    # Speaker dot grid (3x3 small holes)
    for dx in [-2, 0, 2]:
        for dy in [-2, 0, 2]:
            if abs(dx) + abs(dy) <= 2:
                circle(d, spx + int(dx*s), spy + int(dy*s), max(1, int(0.8*s)),
                       (35, 18, 52))

    # D-pad - lower left
    dcx, dcy = int(20*s), int(47*s)
    draw_dpad(d, dcx, dcy, int(2*s), int(6*s), (55, 35, 78), (35, 18, 52))

    # SELECT/START - very small, center bottom area
    d.ellipse([int(25*s), int(52*s), int(30*s), int(54*s)],
              fill=(88, 60, 120), outline=(60, 38, 85))
    d.ellipse([int(33*s), int(52*s), int(38*s), int(54*s)],
              fill=(88, 60, 120), outline=(60, 38, 85))

    # A and B buttons - lower right (smaller circles)
    b_cx, b_cy = int(39*s), int(46*s)
    br = int(3*s)
    circle(d, b_cx, b_cy, br, (200, 45, 55), (150, 25, 35))
    circle(d, int(47*s), b_cy, br, (200, 45, 55), (150, 25, 35))

    save(img, "gbc", size)


# ─────────────────────────────────────────────
# GBA - Game Boy Advance AGB-001
# Reference: Landscape orientation (wider than tall), indigo color
# Approx 144.5mm wide x 82mm tall - about 16:9 feel
# Screen: centered, takes most of the width
# D-pad: left of screen
# A/B: right of screen
# L shoulder: far top-left tab
# R shoulder: far top-right tab
# SELECT/START: small buttons below screen center
# Analog nub: NOT present on original GBA (that's SP)
# ─────────────────────────────────────────────
def draw_gba(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Body - landscape indigo
    bx1, by1 = int(2*s), int(10*s)
    bx2, by2 = int(62*s), int(54*s)
    d.rounded_rectangle([bx1, by1, bx2, by2], radius=int(5*s),
                         fill=(75, 70, 155), outline=(45, 42, 110))

    # L shoulder tab - top left bump
    d.rounded_rectangle([int(2*s), int(6*s), int(16*s), int(12*s)],
                         radius=int(3*s), fill=(60, 56, 135), outline=(38, 35, 98))
    # R shoulder tab - top right bump
    d.rounded_rectangle([int(48*s), int(6*s), int(62*s), int(12*s)],
                         radius=int(3*s), fill=(60, 56, 135), outline=(38, 35, 98))

    # Screen area - centered, dark surround
    d.rounded_rectangle([int(18*s), int(13*s), int(46*s), int(43*s)],
                         radius=int(2*s), fill=(35, 33, 68), outline=(22, 20, 45))

    # Actual screen - darker LCD (GBA screen was unlit)
    d.rounded_rectangle([int(20*s), int(15*s), int(44*s), int(41*s)],
                         radius=int(1*s), fill=(88, 108, 65), outline=(60, 78, 42))

    # D-pad left of screen
    dcx, dcy = int(11*s), int(30*s)
    draw_dpad(d, dcx, dcy, int(2*s), int(6*s), (45, 42, 95), (28, 25, 65))

    # A button - right of screen
    a_cx, a_cy = int(55*s), int(28*s)
    circle(d, a_cx, a_cy, int(4*s), (195, 35, 40), (145, 18, 22))
    # B button - lower-left of A
    circle(d, int(50*s), int(34*s), int(4*s), (195, 35, 40), (145, 18, 22))

    # SELECT button - below screen center-left
    d.ellipse([int(22*s), int(45*s), int(28*s), int(48*s)],
              fill=(55, 52, 110), outline=(35, 32, 80))
    # START button - below screen center-right
    d.ellipse([int(36*s), int(45*s), int(42*s), int(48*s)],
              fill=(55, 52, 110), outline=(35, 32, 80))

    save(img, "gba", size)


# ─────────────────────────────────────────────
# Genesis - Sega Genesis 6-button controller
# Reference: Black rounded rectangle, D-pad left
# 6 face buttons: top row X/Y/Z (left to right), bottom row A/B/C
# MODE button: small, right edge
# START button: large oval, upper center
# Shape is rounder/more ergonomic than NES
# ─────────────────────────────────────────────
def draw_genesis(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Body - black, rounder
    d.rounded_rectangle([int(3*s), int(12*s), int(61*s), int(54*s)],
                         radius=int(8*s), fill=(35, 35, 38), outline=(18, 18, 20))

    # Face plate highlight - very dark grey
    d.rounded_rectangle([int(5*s), int(14*s), int(59*s), int(52*s)],
                         radius=int(7*s), fill=(42, 42, 46), outline=(28, 28, 30))

    # D-pad - left side
    dcx, dcy = int(16*s), int(33*s)
    draw_dpad(d, dcx, dcy, int(3*s), int(7*s), (18, 18, 20), (10, 10, 12))

    # START button - large oval, upper center
    d.ellipse([int(25*s), int(18*s), int(39*s), int(24*s)],
              fill=(55, 55, 60), outline=(35, 35, 38))

    # Top row buttons (X/Y/Z) - smaller
    btn_y_top = int(28*s)
    btn_r = int(4*s)
    # X (blue-tinted in some versions, using grey here)
    circle(d, int(38*s), btn_y_top, btn_r, (55, 55, 62), (35, 35, 40))
    # Y
    circle(d, int(46*s), btn_y_top, btn_r, (55, 55, 62), (35, 35, 40))
    # Z
    circle(d, int(54*s), btn_y_top, btn_r, (55, 55, 62), (35, 35, 40))

    # Bottom row buttons (A/B/C) - larger
    btn_y_bot = int(39*s)
    circle(d, int(38*s), btn_y_bot, btn_r, (62, 62, 68), (38, 38, 44))
    circle(d, int(46*s), btn_y_bot, btn_r, (62, 62, 68), (38, 38, 44))
    circle(d, int(54*s), btn_y_bot, btn_r, (62, 62, 68), (38, 38, 44))

    # MODE button - tiny, right side
    circle(d, int(57*s), int(22*s), int(2*s), (48, 48, 52), (30, 30, 33))

    save(img, "genesis", size)


# ─────────────────────────────────────────────
# Master System - Sega Master System controller
# Reference: Black rectangle, more angular than NES
# D-pad: left side, square-ish cross
# Button 1 and Button 2: right side, red round buttons
# No start button on front (it's on the console)
# Slightly smaller/narrower than NES controller
# ─────────────────────────────────────────────
def draw_mastersystem(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Body - near-black, less rounded than NES
    d.rounded_rectangle([int(5*s), int(18*s), int(59*s), int(48*s)],
                         radius=int(3*s), fill=(28, 28, 32), outline=(15, 15, 18))

    # Face plate
    d.rounded_rectangle([int(7*s), int(20*s), int(57*s), int(46*s)],
                         radius=int(2*s), fill=(35, 35, 40), outline=(22, 22, 26))

    # D-pad - left side, square Sega style cross
    dcx, dcy = int(18*s), int(33*s)
    dw, dh = int(3*s), int(7*s)
    draw_dpad(d, dcx, dcy, dw, dh, (20, 20, 24), (10, 10, 13))

    # Button 1 - red circle, right side
    b1_cx, b1_cy = int(44*s), int(30*s)
    br = int(5*s)
    circle(d, b1_cx, b1_cy, br, (185, 28, 33), (130, 15, 18))
    # Highlight
    circle(d, b1_cx - int(1*s), b1_cy - int(1*s), int(2*s), (210, 55, 60))

    # Button 2 - red circle, below and right
    b2_cx, b2_cy = int(50*s), int(38*s)
    circle(d, b2_cx, b2_cy, br, (185, 28, 33), (130, 15, 18))
    circle(d, b2_cx - int(1*s), b2_cy - int(1*s), int(2*s), (210, 55, 60))

    # Cable nub top center
    nc = int(32*s)
    d.rectangle([nc - int(4*s), int(14*s), nc + int(4*s), int(19*s)],
                fill=(22, 22, 26))

    save(img, "mastersystem", size)


# ─────────────────────────────────────────────
# Arcade - Upright cabinet silhouette
# Reference: Classic JAMMA upright
# Marquee: top colored band (bright, backlit feel)
# Bezel: black area around monitor
# Monitor: CRT screen, slightly inset
# Control panel: angled panel with joystick + 6 buttons
# Side art: colored accent stripe
# T-molding at edges
# ─────────────────────────────────────────────
def draw_arcade(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Cabinet body - dark grey/black
    cab_x1, cab_y1 = int(10*s), int(3*s)
    cab_x2, cab_y2 = int(54*s), int(62*s)
    d.rounded_rectangle([cab_x1, cab_y1, cab_x2, cab_y2], radius=int(2*s),
                         fill=(38, 38, 42), outline=(22, 22, 26))

    # Marquee at top - bright red band
    d.rectangle([int(10*s), int(3*s), int(54*s), int(13*s)],
                fill=(190, 28, 32), outline=(140, 15, 18))
    # Marquee highlight
    d.rectangle([int(11*s), int(4*s), int(53*s), int(7*s)],
                fill=(210, 55, 58))

    # Bezel / monitor area
    d.rounded_rectangle([int(12*s), int(14*s), int(52*s), int(40*s)],
                         radius=int(2*s), fill=(22, 22, 26), outline=(15, 15, 18))

    # Screen - CRT warm glow, slightly blue-shifted
    d.rounded_rectangle([int(14*s), int(16*s), int(50*s), int(38*s)],
                         radius=int(2*s), fill=(28, 55, 95), outline=(20, 40, 72))
    # Screen scanline feel - slightly lighter horizontal bands
    for y in range(17, 38, 3):
        d.rectangle([int(14*s), int(y*s), int(50*s), int(y*s + int(1*s))],
                    fill=(35, 65, 108))

    # Speaker grille area - left side of cabinet face
    for i in range(3):
        gx = int(12*s)
        gy = int((14 + i*3)*s)
        d.rectangle([gx, gy, gx + int(1*s), gy + int(2*s)], fill=(50, 50, 55))

    # Control panel - angled panel below screen
    # Trapezoid: wider at bottom
    cp_pts = [
        (int(10*s), int(40*s)),   # top-left
        (int(54*s), int(40*s)),   # top-right
        (int(56*s), int(52*s)),   # bottom-right
        (int(8*s), int(52*s)),    # bottom-left
    ]
    d.polygon(cp_pts, fill=(48, 48, 52), outline=(30, 30, 34))

    # Joystick on control panel - left side
    jx, jy = int(22*s), int(46*s)
    circle(d, jx, jy + int(1*s), int(3*s), (22, 22, 26), (12, 12, 14))  # base
    circle(d, jx, jy - int(1*s), int(2*s), (55, 55, 60), (35, 35, 38))  # stick top
    circle(d, jx, jy - int(2*s), int(1*s), (75, 75, 80))  # ball top

    # 6 buttons - two rows of 3, right side
    btn_colors = [
        (185, 30, 35),   # red
        (35, 145, 60),   # green
        (40, 80, 185),   # blue
        (185, 30, 35),   # red
        (35, 145, 60),   # green
        (40, 80, 185),   # blue
    ]
    br = int(2*s)
    for i, col in enumerate(btn_colors):
        row = i // 3
        col_idx = i % 3
        bx = int(34*s) + col_idx * int(6*s)
        by = int(43*s) + row * int(5*s)
        circle(d, bx, by, br, col, tuple(max(0, c - 45) for c in col))

    # Coin door - bottom panel
    d.rectangle([int(16*s), int(54*s), int(48*s), int(60*s)],
                fill=(50, 50, 55), outline=(35, 35, 38))
    # Coin slots
    d.ellipse([int(24*s), int(55*s), int(30*s), int(59*s)],
              fill=(35, 35, 38), outline=(25, 25, 28))
    d.ellipse([int(34*s), int(55*s), int(40*s), int(59*s)],
              fill=(35, 35, 38), outline=(25, 25, 28))

    save(img, "arcade", size)


# ─────────────────────────────────────────────
# PSX - Original PlayStation controller SCPH-1080
# Reference: Grey dual-grip controller, no analog sticks (pre-DualShock)
# Body: light warm grey (#B8B8B8), two bottom handles
# D-pad: left side, cross shape
# Face buttons: right side, diamond arrangement
#   Triangle: green, Circle: red, Cross (X): blue, Square: pink/magenta
# SELECT/START: center small buttons
# L1/R1 shoulder buttons: top
# L2/R2: secondary shoulder (not visible from front typically)
# ─────────────────────────────────────────────
def draw_psx(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    body_color = (185, 185, 188)
    body_outline = (135, 135, 138)

    # Main body
    d.rounded_rectangle([int(4*s), int(12*s), int(60*s), int(40*s)],
                         radius=int(5*s), fill=body_color, outline=body_outline)

    # Left grip handle
    d.rounded_rectangle([int(8*s), int(36*s), int(22*s), int(54*s)],
                         radius=int(6*s), fill=body_color, outline=body_outline)
    # Right grip handle
    d.rounded_rectangle([int(42*s), int(36*s), int(56*s), int(54*s)],
                         radius=int(6*s), fill=body_color, outline=body_outline)

    # Face - slightly different shade
    d.rounded_rectangle([int(6*s), int(14*s), int(58*s), int(38*s)],
                         radius=int(4*s), fill=(195, 195, 198), outline=(160, 160, 162))

    # L1 shoulder - top left
    d.rounded_rectangle([int(4*s), int(8*s), int(22*s), int(14*s)],
                         radius=int(3*s), fill=(165, 165, 168), outline=(125, 125, 128))
    # R1 shoulder - top right
    d.rounded_rectangle([int(42*s), int(8*s), int(60*s), int(14*s)],
                         radius=int(3*s), fill=(165, 165, 168), outline=(125, 125, 128))

    # D-pad
    dcx, dcy = int(18*s), int(26*s)
    draw_dpad(d, dcx, dcy, int(3*s), int(7*s), (85, 85, 88), (55, 55, 58))

    # SELECT button
    d.ellipse([int(24*s), int(28*s), int(30*s), int(31*s)],
              fill=(155, 155, 158), outline=(120, 120, 123))
    # START button
    d.ellipse([int(34*s), int(28*s), int(40*s), int(31*s)],
              fill=(155, 155, 158), outline=(120, 120, 123))

    # ANALOG button (center - this is original non-DualShock so no sticks)
    circle(d, int(32*s), int(24*s), int(2*s), (165, 165, 168), (130, 130, 133))

    # Face buttons diamond
    btn_cx, btn_cy = int(47*s), int(25*s)
    btn_r = int(4*s)
    # Triangle (top) - green
    circle(d, btn_cx, btn_cy - int(7*s), btn_r, (55, 165, 85), (30, 120, 55))
    # Circle (right) - red
    circle(d, btn_cx + int(7*s), btn_cy, btn_r, (195, 40, 45), (145, 20, 25))
    # Cross/X (bottom) - blue
    circle(d, btn_cx, btn_cy + int(7*s), btn_r, (65, 95, 195), (40, 60, 145))
    # Square (left) - pink/magenta
    circle(d, btn_cx - int(7*s), btn_cy, btn_r, (195, 70, 165), (148, 40, 125))

    save(img, "psx", size)


# ─────────────────────────────────────────────
# PSP - PSP-1000 "Phat" piano black
# Reference: Landscape widescreen handheld, black
# Body: ~16:9 aspect, matte/glossy black (#1A1A1E)
# Screen: widescreen, takes center ~60% of width
# D-pad: lower-left
# Analog nub: left side, between D-pad and screen
# Face buttons: lower-right (triangle, circle, cross, square)
# L/R shoulder buttons: top edges
# HOME button: below screen center
# SELECT/START: below screen, small
# ─────────────────────────────────────────────
def draw_psp(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Body - piano black, landscape
    d.rounded_rectangle([int(2*s), int(8*s), int(62*s), int(56*s)],
                         radius=int(6*s), fill=(26, 26, 32), outline=(14, 14, 18))

    # Face - slightly lighter to separate
    d.rounded_rectangle([int(4*s), int(10*s), int(60*s), int(54*s)],
                         radius=int(5*s), fill=(32, 32, 38), outline=(20, 20, 25))

    # L shoulder button - top left protruding
    d.rounded_rectangle([int(2*s), int(5*s), int(18*s), int(11*s)],
                         radius=int(3*s), fill=(20, 20, 26), outline=(12, 12, 16))
    # R shoulder button - top right
    d.rounded_rectangle([int(46*s), int(5*s), int(62*s), int(11*s)],
                         radius=int(3*s), fill=(20, 20, 26), outline=(12, 12, 16))

    # Screen surround
    d.rounded_rectangle([int(18*s), int(12*s), int(50*s), int(44*s)],
                         radius=int(2*s), fill=(16, 16, 20), outline=(10, 10, 14))
    # Screen - PSP's widescreen UMD display
    d.rounded_rectangle([int(19*s), int(13*s), int(49*s), int(43*s)],
                         radius=int(1*s), fill=(18, 42, 88), outline=(12, 30, 65))
    # Screen highlight
    d.line([int(20*s), int(14*s), int(35*s), int(14*s)],
           fill=(28, 58, 115), width=max(1, int(1*s)))

    # Analog nub - PSP has a small rubber analog nub, lower-left area
    circle(d, int(12*s), int(34*s), int(4*s), (48, 48, 54), (30, 30, 35))
    # Nub dot
    circle(d, int(12*s), int(34*s), int(2*s), (65, 65, 72))

    # D-pad - far left
    dcx, dcy = int(8*s), int(44*s)
    draw_dpad(d, dcx, dcy, int(2*s), int(5*s), (22, 22, 28), (12, 12, 16))

    # HOME button - center below screen
    circle(d, int(32*s), int(48*s), int(2*s), (40, 40, 48), (25, 25, 30))

    # SELECT - left of HOME
    d.ellipse([int(22*s), int(47*s), int(26*s), int(49*s)],
              fill=(38, 38, 45), outline=(24, 24, 30))
    # START - right of HOME
    d.ellipse([int(38*s), int(47*s), int(42*s), int(49*s)],
              fill=(38, 38, 45), outline=(24, 24, 30))

    # Face buttons - lower right
    btn_cx, btn_cy = int(55*s), int(36*s)
    btn_r = int(3*s)
    # Triangle (top) - green
    circle(d, btn_cx, btn_cy - int(5*s), btn_r, (55, 165, 85), (30, 120, 55))
    # Circle (right) - red
    circle(d, btn_cx + int(5*s), btn_cy, btn_r, (195, 40, 45), (145, 20, 25))
    # Cross (bottom) - blue
    circle(d, btn_cx, btn_cy + int(5*s), btn_r, (65, 95, 195), (40, 60, 145))
    # Square (left) - pink
    circle(d, btn_cx - int(5*s), btn_cy, btn_r, (195, 70, 165), (148, 40, 125))

    # Volume rocker - right side
    d.rounded_rectangle([int(56*s), int(20*s), int(60*s), int(30*s)],
                         radius=int(1*s), fill=(22, 22, 28), outline=(14, 14, 18))

    save(img, "psp", size)


# ─────────────────────────────────────────────
# Generate all icons at both sizes
# ─────────────────────────────────────────────
GENERATORS = [
    ("nes", draw_nes),
    ("snes", draw_snes),
    ("n64", draw_n64),
    ("gb", draw_gb),
    ("gbc", draw_gbc),
    ("gba", draw_gba),
    ("genesis", draw_genesis),
    ("mastersystem", draw_mastersystem),
    ("arcade", draw_arcade),
    ("psx", draw_psx),
    ("psp", draw_psp),
]

if __name__ == "__main__":
    print("Generating CartDex system icons v3 (reference-grounded)...")
    for name, fn in GENERATORS:
        print(f"\n{name.upper()}")
        fn(32)
        fn(64)
    print("\nDone. All 22 icons written.")
