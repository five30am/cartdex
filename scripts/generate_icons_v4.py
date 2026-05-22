#!/usr/bin/env python3
"""
CartDex System Icons v4 - v3 shapes + v2 color/line discipline
Key changes from v3:
- Hard 1px dark outlines (near-black #1A1A1A) on all shapes
- Flat fill colors, no graduated inner-face layers
- Pushed saturation on colored buttons (red redder, yellow yellower, etc.)
- Single-step highlight instead of multi-step gradient shading
- Reduced inner contrast zones — read crisp at 16px
- N64: flat top edge, grey analog stick (not blue), START above stick
"""

from PIL import Image, ImageDraw
import os

OUT_DIR = "/home/claude/projects/cartdex/public/icons/systems"
os.makedirs(OUT_DIR, exist_ok=True)

# ─── PALETTE (v4 — punchy, saturated, flat) ───────────────────────────────────
# Outlines: near-black everywhere
OUTLINE = (20, 20, 22)

# Body fills — distinct, solid reads
GREY_NES      = (110, 110, 115)    # NES charcoal grey
GREY_N64      = (148, 148, 148)    # N64 body grey (mid-grey)
GREY_STICK    = (160, 160, 164)    # N64 center analog stick (real grey)
GREY_SHOULDER = (120, 120, 122)    # N64 shoulder buttons
GREY_PSX      = (192, 192, 196)    # PSX warm light grey
GREY_GBA      = (168, 168, 172)    # GBA face accent

PURPLE_SNES   = (145, 138, 178)    # SNES body
PURPLE_GBC    = (128, 88, 172)     # GBC atomic purple

INDIGO_GBA    = (78, 72, 162)      # GBA body

BLACK_GENESIS = (30, 30, 34)       # Genesis/Master System near-black
BLACK_PSP     = (24, 24, 30)       # PSP piano black

# Colored buttons — SATURATED
RED_BTN       = (210, 28, 32)      # NES/GB/GBC/GBA/PSX A, Master System buttons
RED_BTN_DARK  = (145, 12, 15)      # outline for red buttons
RED_START_N64 = (215, 25, 30)      # N64 START
YELLOW_C      = (225, 190, 20)     # N64 C-buttons
YELLOW_DARK   = (158, 130, 8)
GREEN_Y_SNES  = (48, 168, 62)      # SNES Y
GREEN_DARK    = (28, 112, 38)
BLUE_X_SNES   = (42, 90, 210)      # SNES X
BLUE_DARK     = (22, 55, 148)
YELLOW_B_SNES = (228, 195, 18)     # SNES B
YELLOW_B_DARK = (160, 135, 8)
RED_A_SNES    = (210, 38, 38)      # SNES A

GREEN_TRI     = (45, 175, 75)      # PSX/PSP triangle
GREEN_TRI_DK  = (22, 120, 45)
RED_CIR       = (210, 35, 40)      # PSX/PSP circle
RED_CIR_DK    = (148, 15, 18)
BLUE_CRS      = (55, 88, 210)      # PSX/PSP cross
BLUE_CRS_DK   = (30, 52, 148)
PINK_SQR      = (205, 62, 178)     # PSX/PSP square
PINK_SQR_DK   = (148, 35, 128)

GREEN_B_N64   = (48, 168, 58)      # N64 B button
GREEN_B_DK    = (25, 112, 32)
BLUE_A_N64    = (42, 78, 210)      # N64 A button
BLUE_A_DK     = (22, 45, 148)

# Screen fills
SCREEN_GB     = (118, 148, 72)     # GB greenish LCD
SCREEN_GBC    = (128, 158, 82)     # GBC screen
SCREEN_GBA    = (80, 105, 55)      # GBA unlit screen
SCREEN_ARCADE = (22, 48, 98)       # CRT screen blue
SCREEN_PSP    = (16, 40, 92)       # PSP screen

# Arcade marquee
RED_MARQUEE   = (200, 28, 32)
YELLOW_SCREEN = (200, 175, 40)     # arcade warm screen glow


def make_canvas(size):
    return Image.new("RGBA", (size, size), (0, 0, 0, 0))


def save(img, name, size):
    path = os.path.join(OUT_DIR, f"{name}-{size}.png")
    img.save(path, "PNG")
    print(f"  saved {path}")


def draw_dpad(draw, cx, cy, arm_w, arm_h, color, outline_color=None):
    """Plus-sign D-pad. Hard outline."""
    oc = outline_color if outline_color else OUTLINE
    draw.rectangle([cx - arm_h, cy - arm_w, cx + arm_h, cy + arm_w], fill=color, outline=oc)
    draw.rectangle([cx - arm_w, cy - arm_h, cx + arm_w, cy + arm_h], fill=color, outline=oc)
    draw.rectangle([cx - arm_w, cy - arm_w, cx + arm_w, cy + arm_w], fill=color)


def circle(draw, cx, cy, r, fill, outline=None):
    oc = outline if outline else OUTLINE
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill, outline=oc)


def rect(draw, x1, y1, x2, y2, fill, radius=0, outline=None):
    oc = outline if outline else OUTLINE
    if radius:
        draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=fill, outline=oc)
    else:
        draw.rectangle([x1, y1, x2, y2], fill=fill, outline=oc)


# ─────────────────────────────────────────────
# NES
# v3 shapes kept. v4: drop inner face-plate layer, single body fill,
# darker outline, more saturated red buttons
# ─────────────────────────────────────────────
def draw_nes(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Single body — no inner faceplate layer (v2 was flat)
    bx1, by1 = int(4*s), int(16*s)
    bx2, by2 = int(60*s), int(50*s)
    rect(d, bx1, by1, bx2, by2, GREY_NES, radius=int(4*s))

    # D-pad
    dcx, dcy = int(17*s), int(33*s)
    draw_dpad(d, dcx, dcy, int(3*s), int(7*s), (28, 28, 30))

    # SELECT oval
    sel_cy = int(36*s)
    d.ellipse([int(26*s), sel_cy - int(2*s), int(34*s), sel_cy + int(2*s)],
              fill=(75, 75, 78), outline=OUTLINE)
    # START oval
    d.ellipse([int(36*s), sel_cy - int(2*s), int(44*s), sel_cy + int(2*s)],
              fill=(75, 75, 78), outline=OUTLINE)

    # B button
    circle(d, int(46*s), int(33*s), int(4*s), RED_BTN, RED_BTN_DARK)
    # A button
    circle(d, int(54*s), int(33*s), int(4*s), RED_BTN, RED_BTN_DARK)

    # Connector nub top center
    nc = int(32*s)
    d.rectangle([nc - int(4*s), int(13*s), nc + int(4*s), int(16*s)],
                fill=(82, 82, 86), outline=OUTLINE)

    save(img, "nes", size)


# ─────────────────────────────────────────────
# SNES
# v3 shapes kept. v4: remove double inner face, flatten grips,
# hard outlines, push button saturation
# ─────────────────────────────────────────────
def draw_snes(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Main body — single fill
    bx1, by1 = int(3*s), int(14*s)
    bx2, by2 = int(61*s), int(52*s)
    rect(d, bx1, by1, bx2, by2, PURPLE_SNES, radius=int(8*s))

    # Grip bumps (draw filled over body edge, same color — they are part of the silhouette)
    d.ellipse([int(3*s), int(44*s), int(18*s), int(57*s)],
              fill=PURPLE_SNES, outline=OUTLINE)
    d.ellipse([int(46*s), int(44*s), int(61*s), int(57*s)],
              fill=PURPLE_SNES, outline=OUTLINE)

    # L shoulder
    rect(d, int(3*s), int(10*s), int(20*s), int(15*s), (118, 112, 148), radius=int(3*s))
    # R shoulder
    rect(d, int(44*s), int(10*s), int(61*s), int(15*s), (118, 112, 148), radius=int(3*s))

    # D-pad
    dcx, dcy = int(19*s), int(33*s)
    draw_dpad(d, dcx, dcy, int(3*s), int(8*s), (38, 35, 48))

    # SELECT oval
    d.ellipse([int(26*s), int(33*s), int(34*s), int(37*s)],
              fill=(98, 92, 118), outline=OUTLINE)
    # START oval
    d.ellipse([int(35*s), int(33*s), int(43*s), int(37*s)],
              fill=(98, 92, 118), outline=OUTLINE)

    # Face buttons — SNES JP/EU palette, full saturation
    btn_cx, btn_cy = int(48*s), int(31*s)
    btn_r = int(4*s)
    circle(d, btn_cx - int(7*s), btn_cy, btn_r, GREEN_Y_SNES, GREEN_DARK)    # Y
    circle(d, btn_cx + int(7*s), btn_cy, btn_r, RED_A_SNES, RED_BTN_DARK)    # A
    circle(d, btn_cx, btn_cy - int(7*s), btn_r, BLUE_X_SNES, BLUE_DARK)      # X
    circle(d, btn_cx, btn_cy + int(7*s), btn_r, YELLOW_B_SNES, YELLOW_B_DARK) # B

    save(img, "snes", size)


# ─────────────────────────────────────────────
# N64 — GEOMETRY CORRECTED FOR V4
# Changes:
# 1. Flat top: top edge of whole controller is a straight horizontal line
#    (L/R shoulders sit flush across the top — no dome/curve above prongs)
# 2. Grey analog stick center (was incorrectly blue in v3)
# 3. START button above the center stick (not below it)
# Prong shape retained from v3.
# ─────────────────────────────────────────────
def draw_n64(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    body_color = GREY_N64
    oc = OUTLINE

    # FLAT TOP BAR — a rectangle across the full width at the top
    # This represents the flat top edge where L/R shoulder buttons sit flush
    top_bar_y1 = int(14*s)
    top_bar_y2 = int(22*s)
    d.rectangle([int(2*s), top_bar_y1, int(62*s), top_bar_y2],
                fill=body_color, outline=oc)

    # Left prong — hangs below the flat top bar
    d.rounded_rectangle([int(2*s), top_bar_y1, int(22*s), int(50*s)],
                         radius=int(4*s), fill=body_color, outline=oc)
    # Center prong — tallest, hangs down furthest
    d.rounded_rectangle([int(22*s), top_bar_y1, int(42*s), int(54*s)],
                         radius=int(4*s), fill=body_color, outline=oc)
    # Right prong
    d.rounded_rectangle([int(42*s), top_bar_y1, int(62*s), int(50*s)],
                         radius=int(4*s), fill=body_color, outline=oc)

    # Horizontal connector bar between prongs (fill the gap between them)
    d.rectangle([int(2*s), int(22*s), int(62*s), int(36*s)],
                fill=body_color)
    # Redraw outline on flat top now that fill overlaps it
    d.line([int(2*s), top_bar_y1, int(62*s), top_bar_y1], fill=oc, width=1)

    # L shoulder button — sits on flat top, left
    rect(d, int(2*s), int(10*s), int(20*s), top_bar_y1, GREY_SHOULDER, radius=int(2*s))
    # R shoulder button — sits on flat top, right
    rect(d, int(44*s), int(10*s), int(62*s), top_bar_y1, GREY_SHOULDER, radius=int(2*s))

    # D-pad on left prong
    dcx, dcy = int(12*s), int(35*s)
    draw_dpad(d, dcx, dcy, int(2*s), int(6*s), (40, 40, 42))

    # *** RED START button in CENTER PRONG — above the analog stick ***
    # N64 START is the large round button above the center stick
    start_cx, start_cy = int(32*s), int(28*s)
    circle(d, start_cx, start_cy, int(3*s), RED_START_N64, RED_BTN_DARK)

    # *** GREY analog stick on CENTER PRONG — below START ***
    stick_cx, stick_cy = int(32*s), int(40*s)
    circle(d, stick_cx, stick_cy, int(5*s), GREY_STICK, (100, 100, 104))
    # Inner nub highlight — single step, flat
    circle(d, stick_cx - int(1*s), stick_cy - int(1*s), int(2*s), (188, 188, 192))

    # Yellow C-buttons on right prong (4-way diamond)
    ccx, ccy = int(52*s), int(30*s)
    cr = int(3*s)
    circle(d, ccx, ccy - int(5*s), cr, YELLOW_C, YELLOW_DARK)   # C-up
    circle(d, ccx, ccy + int(5*s), cr, YELLOW_C, YELLOW_DARK)   # C-down
    circle(d, ccx - int(5*s), ccy, cr, YELLOW_C, YELLOW_DARK)   # C-left
    circle(d, ccx + int(5*s), ccy, cr, YELLOW_C, YELLOW_DARK)   # C-right

    # Green B button — upper left prong
    circle(d, int(12*s), int(25*s), int(3*s), GREEN_B_N64, GREEN_B_DK)

    # Blue A button — right prong lower
    circle(d, int(52*s), int(43*s), int(4*s), BLUE_A_N64, BLUE_A_DK)

    save(img, "n64", size)


# ─────────────────────────────────────────────
# GB — Game Boy DMG-01
# v3 shapes kept. v4: single body fill, crisper outline, deeper red buttons,
# remove screen reflection highlight (adds softness)
# ─────────────────────────────────────────────
def draw_gb(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Body — single flat grey
    rect(d, int(8*s), int(2*s), int(56*s), int(62*s), (172, 172, 165), radius=int(6*s))

    # Screen surround — dark single fill
    rect(d, int(11*s), int(7*s), int(53*s), int(35*s), (62, 64, 60), radius=int(3*s))

    # Screen — GB green LCD
    rect(d, int(15*s), int(10*s), int(49*s), int(32*s), SCREEN_GB, radius=int(2*s))

    # Power LED
    circle(d, int(13*s), int(5*s), int(1*s), (225, 55, 55))

    # D-pad lower-left
    dcx, dcy = int(19*s), int(47*s)
    draw_dpad(d, dcx, dcy, int(2*s), int(6*s), (40, 40, 38))

    # SELECT
    sel_cx, sel_cy = int(27*s), int(50*s)
    d.ellipse([sel_cx - int(4*s), sel_cy - int(2*s),
               sel_cx + int(4*s), sel_cy + int(2*s)],
              fill=(138, 138, 130), outline=OUTLINE)
    # START
    sta_cx = int(35*s)
    d.ellipse([sta_cx - int(4*s), sel_cy - int(2*s),
               sta_cx + int(4*s), sel_cy + int(2*s)],
              fill=(138, 138, 130), outline=OUTLINE)

    # B button
    circle(d, int(41*s), int(46*s), int(4*s), RED_BTN, RED_BTN_DARK)
    # A button
    circle(d, int(49*s), int(46*s), int(4*s), RED_BTN, RED_BTN_DARK)

    # Speaker slits — vertical lines, bottom right
    sx = int(43*s)
    for i in range(4):
        lx = sx + int(i * 2.5 * s)
        d.line([lx, int(54*s), lx, int(59*s)], fill=(95, 95, 90), width=max(1, int(1*s)))

    save(img, "gb", size)


# ─────────────────────────────────────────────
# GBC — Game Boy Color (Atomic Purple)
# v3 shapes kept. v4: flatten dual-highlight layer to single body fill,
# push purple saturation, harder outline, bigger red buttons
# ─────────────────────────────────────────────
def draw_gbc(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Body — saturated atomic purple, single fill
    rect(d, int(8*s), int(2*s), int(56*s), int(62*s), PURPLE_GBC, radius=int(8*s))

    # Screen surround
    rect(d, int(13*s), int(8*s), int(51*s), int(34*s), (42, 28, 60), radius=int(3*s))

    # Screen
    rect(d, int(16*s), int(11*s), int(48*s), int(31*s), SCREEN_GBC, radius=int(2*s))

    # IR port top center
    d.ellipse([int(28*s), int(2*s), int(36*s), int(5*s)],
              fill=(38, 22, 55), outline=OUTLINE)

    # Circular speaker grille top-right
    spx, spy = int(44*s), int(19*s)
    circle(d, spx, spy, int(5*s), (55, 38, 78), (35, 22, 52))
    for dx in [-2, 0, 2]:
        for dy in [-2, 0, 2]:
            if abs(dx) + abs(dy) <= 2:
                circle(d, spx + int(dx*s), spy + int(dy*s), max(1, int(0.8*s)),
                       (28, 15, 42))

    # D-pad lower-left
    draw_dpad(d, int(20*s), int(47*s), int(2*s), int(6*s), (50, 32, 72))

    # SELECT/START tiny ovals
    d.ellipse([int(25*s), int(52*s), int(30*s), int(54*s)],
              fill=(82, 55, 112), outline=OUTLINE)
    d.ellipse([int(33*s), int(52*s), int(38*s), int(54*s)],
              fill=(82, 55, 112), outline=OUTLINE)

    # A and B — punchy red
    circle(d, int(39*s), int(46*s), int(3*s), RED_BTN, RED_BTN_DARK)
    circle(d, int(47*s), int(46*s), int(3*s), RED_BTN, RED_BTN_DARK)

    save(img, "gbc", size)


# ─────────────────────────────────────────────
# GBA — Game Boy Advance
# v3 shapes kept. v4: flatten body, harder edge on shoulder tabs,
# push red button saturation
# ─────────────────────────────────────────────
def draw_gba(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Body — indigo, single fill
    rect(d, int(2*s), int(10*s), int(62*s), int(54*s), INDIGO_GBA, radius=int(5*s))

    # L shoulder tab
    rect(d, int(2*s), int(6*s), int(16*s), int(12*s), (58, 54, 132), radius=int(3*s))
    # R shoulder tab
    rect(d, int(48*s), int(6*s), int(62*s), int(12*s), (58, 54, 132), radius=int(3*s))

    # Screen surround — dark
    rect(d, int(18*s), int(13*s), int(46*s), int(43*s), (30, 28, 60), radius=int(2*s))
    # Screen — GBA unlit green
    rect(d, int(20*s), int(15*s), int(44*s), int(41*s), SCREEN_GBA, radius=int(1*s))

    # D-pad
    draw_dpad(d, int(11*s), int(30*s), int(2*s), int(6*s), (42, 40, 90))

    # A button
    circle(d, int(55*s), int(28*s), int(4*s), RED_BTN, RED_BTN_DARK)
    # B button
    circle(d, int(50*s), int(34*s), int(4*s), RED_BTN, RED_BTN_DARK)

    # SELECT oval
    d.ellipse([int(22*s), int(45*s), int(28*s), int(48*s)],
              fill=(52, 50, 108), outline=OUTLINE)
    # START oval
    d.ellipse([int(36*s), int(45*s), int(42*s), int(48*s)],
              fill=(52, 50, 108), outline=OUTLINE)

    save(img, "gba", size)


# ─────────────────────────────────────────────
# Genesis — Sega Genesis 6-button
# v3 shapes kept. v4: remove inner faceplate highlight,
# flatten to single near-black body, harder outline contrast
# ─────────────────────────────────────────────
def draw_genesis(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Body — single near-black fill
    rect(d, int(3*s), int(12*s), int(61*s), int(54*s), BLACK_GENESIS, radius=int(8*s))

    # D-pad left
    draw_dpad(d, int(16*s), int(33*s), int(3*s), int(7*s), (15, 15, 17))

    # START button oval upper center — slightly lighter to read against body
    d.ellipse([int(25*s), int(18*s), int(39*s), int(24*s)],
              fill=(52, 52, 56), outline=OUTLINE)

    # 6 face buttons — two rows, flat grey (Genesis buttons are unlabeled grey)
    btn_r = int(4*s)
    for row, y_pos in enumerate([int(28*s), int(39*s)]):
        for col, x_pos in enumerate([int(38*s), int(46*s), int(54*s)]):
            circle(d, x_pos, y_pos, btn_r, (52, 52, 58), (32, 32, 36))

    # MODE button tiny — right edge
    circle(d, int(57*s), int(22*s), int(2*s), (45, 45, 50), (28, 28, 32))

    save(img, "genesis", size)


# ─────────────────────────────────────────────
# Master System
# v3 shapes kept. v4: flatten to single black body,
# push red button saturation, remove inner faceplate
# ─────────────────────────────────────────────
def draw_mastersystem(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Body — single near-black, angular
    rect(d, int(5*s), int(18*s), int(59*s), int(48*s), BLACK_GENESIS, radius=int(3*s))

    # D-pad left
    draw_dpad(d, int(18*s), int(33*s), int(3*s), int(7*s), (15, 15, 17))

    # Button 1
    circle(d, int(44*s), int(30*s), int(5*s), RED_BTN, RED_BTN_DARK)
    # Button 2
    circle(d, int(50*s), int(38*s), int(5*s), RED_BTN, RED_BTN_DARK)

    # Cable nub top center
    nc = int(32*s)
    d.rectangle([nc - int(4*s), int(14*s), nc + int(4*s), int(19*s)],
                fill=(20, 20, 24), outline=OUTLINE)

    save(img, "mastersystem", size)


# ─────────────────────────────────────────────
# Arcade
# v3 shapes kept. v4: saturate marquee red, flatten screen,
# remove scanline bands (added softness), hard outlines throughout
# ─────────────────────────────────────────────
def draw_arcade(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Cabinet body — flat dark
    rect(d, int(10*s), int(3*s), int(54*s), int(62*s), (35, 35, 38), radius=int(2*s))

    # Marquee — bright red band
    d.rectangle([int(10*s), int(3*s), int(54*s), int(13*s)],
                fill=RED_MARQUEE, outline=OUTLINE)

    # Bezel
    rect(d, int(12*s), int(14*s), int(52*s), int(40*s), (18, 18, 22), radius=int(2*s))

    # Screen — flat CRT blue (no scanlines)
    rect(d, int(14*s), int(16*s), int(50*s), int(38*s), SCREEN_ARCADE, radius=int(2*s))

    # Control panel trapezoid
    cp_pts = [
        (int(10*s), int(40*s)),
        (int(54*s), int(40*s)),
        (int(56*s), int(52*s)),
        (int(8*s),  int(52*s)),
    ]
    d.polygon(cp_pts, fill=(45, 45, 48), outline=OUTLINE)

    # Joystick
    jx, jy = int(22*s), int(46*s)
    circle(d, jx, jy + int(1*s), int(3*s), (18, 18, 22))
    circle(d, jx, jy - int(1*s), int(2*s), (55, 55, 60))

    # 6 buttons — two rows of 3, saturated RGB
    btn_colors = [
        (RED_BTN, RED_BTN_DARK),
        (GREEN_Y_SNES, GREEN_DARK),
        (BLUE_X_SNES, BLUE_DARK),
        (RED_BTN, RED_BTN_DARK),
        (GREEN_Y_SNES, GREEN_DARK),
        (BLUE_X_SNES, BLUE_DARK),
    ]
    br = int(2*s)
    for i, (fill, dark) in enumerate(btn_colors):
        row = i // 3
        col_idx = i % 3
        bx = int(34*s) + col_idx * int(6*s)
        by = int(43*s) + row * int(5*s)
        circle(d, bx, by, br, fill, dark)

    # Coin door
    d.rectangle([int(16*s), int(54*s), int(48*s), int(60*s)],
                fill=(48, 48, 52), outline=OUTLINE)
    d.ellipse([int(24*s), int(55*s), int(30*s), int(59*s)],
              fill=(30, 30, 34), outline=OUTLINE)
    d.ellipse([int(34*s), int(55*s), int(40*s), int(59*s)],
              fill=(30, 30, 34), outline=OUTLINE)

    save(img, "arcade", size)


# ─────────────────────────────────────────────
# PSX — PlayStation SCPH-1080
# v3 shapes kept. v4: single body fill (drop inner faceplate highlight),
# push face button saturation, harder outlines
# ─────────────────────────────────────────────
def draw_psx(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Main body — single warm grey
    rect(d, int(4*s), int(12*s), int(60*s), int(40*s), GREY_PSX, radius=int(5*s))

    # Left grip
    rect(d, int(8*s), int(36*s), int(22*s), int(54*s), GREY_PSX, radius=int(6*s))
    # Right grip
    rect(d, int(42*s), int(36*s), int(56*s), int(54*s), GREY_PSX, radius=int(6*s))

    # L1 shoulder
    rect(d, int(4*s), int(8*s), int(22*s), int(14*s), (162, 162, 165), radius=int(3*s))
    # R1 shoulder
    rect(d, int(42*s), int(8*s), int(60*s), int(14*s), (162, 162, 165), radius=int(3*s))

    # D-pad
    draw_dpad(d, int(18*s), int(26*s), int(3*s), int(7*s), (82, 82, 85))

    # SELECT
    d.ellipse([int(24*s), int(28*s), int(30*s), int(31*s)],
              fill=(155, 155, 158), outline=OUTLINE)
    # START
    d.ellipse([int(34*s), int(28*s), int(40*s), int(31*s)],
              fill=(155, 155, 158), outline=OUTLINE)

    # Face buttons — full PS icon palette
    btn_cx, btn_cy = int(47*s), int(25*s)
    btn_r = int(4*s)
    circle(d, btn_cx, btn_cy - int(7*s), btn_r, GREEN_TRI, GREEN_TRI_DK)   # Triangle
    circle(d, btn_cx + int(7*s), btn_cy, btn_r, RED_CIR, RED_CIR_DK)       # Circle
    circle(d, btn_cx, btn_cy + int(7*s), btn_r, BLUE_CRS, BLUE_CRS_DK)     # Cross
    circle(d, btn_cx - int(7*s), btn_cy, btn_r, PINK_SQR, PINK_SQR_DK)     # Square

    save(img, "psx", size)


# ─────────────────────────────────────────────
# PSP — PSP-1000 piano black
# v3 shapes kept. v4: flatten to single black body,
# push face button saturation, remove soft screen highlight
# ─────────────────────────────────────────────
def draw_psp(size):
    img = make_canvas(size)
    d = ImageDraw.Draw(img)
    s = size / 64

    # Body — single piano black
    rect(d, int(2*s), int(8*s), int(62*s), int(56*s), BLACK_PSP, radius=int(6*s))

    # L shoulder
    rect(d, int(2*s), int(5*s), int(18*s), int(11*s), (18, 18, 24), radius=int(3*s))
    # R shoulder
    rect(d, int(46*s), int(5*s), int(62*s), int(11*s), (18, 18, 24), radius=int(3*s))

    # Screen surround
    rect(d, int(18*s), int(12*s), int(50*s), int(44*s), (14, 14, 18), radius=int(2*s))
    # Screen — flat deep blue
    rect(d, int(19*s), int(13*s), int(49*s), int(43*s), SCREEN_PSP, radius=int(1*s))

    # Analog nub — lower-left, small rubber circle
    circle(d, int(12*s), int(34*s), int(4*s), (42, 42, 48), (28, 28, 34))
    circle(d, int(12*s), int(34*s), int(2*s), (62, 62, 70))

    # D-pad far left
    draw_dpad(d, int(8*s), int(44*s), int(2*s), int(5*s), (20, 20, 26))

    # HOME button
    circle(d, int(32*s), int(48*s), int(2*s), (38, 38, 46), (24, 24, 30))

    # SELECT
    d.ellipse([int(22*s), int(47*s), int(26*s), int(49*s)],
              fill=(36, 36, 42), outline=OUTLINE)
    # START
    d.ellipse([int(38*s), int(47*s), int(42*s), int(49*s)],
              fill=(36, 36, 42), outline=OUTLINE)

    # Face buttons — PS palette
    btn_cx, btn_cy = int(55*s), int(36*s)
    btn_r = int(3*s)
    circle(d, btn_cx, btn_cy - int(5*s), btn_r, GREEN_TRI, GREEN_TRI_DK)
    circle(d, btn_cx + int(5*s), btn_cy, btn_r, RED_CIR, RED_CIR_DK)
    circle(d, btn_cx, btn_cy + int(5*s), btn_r, BLUE_CRS, BLUE_CRS_DK)
    circle(d, btn_cx - int(5*s), btn_cy, btn_r, PINK_SQR, PINK_SQR_DK)

    # Volume rocker right side
    rect(d, int(56*s), int(20*s), int(60*s), int(30*s), (20, 20, 26), radius=int(1*s))

    save(img, "psp", size)


# ─────────────────────────────────────────────
# Generate all icons
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
    print("Generating CartDex system icons v4 (v3 shapes + v2 line/color discipline, N64 geometry fixed)...")
    for name, fn in GENERATORS:
        print(f"\n{name.upper()}")
        fn(32)
        fn(64)
    print("\nDone. All 22 icons written.")
