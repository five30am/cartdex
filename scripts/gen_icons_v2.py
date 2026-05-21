#!/usr/bin/env python3
"""
Cartdex System Icons v2 — Hand PIL pixel art compositor
Each icon drawn at 64x64 native, exported at 32x32 and 64x64.
Design philosophy: per-system personality, era-correct palette, dithering for depth.
"""

from PIL import Image
import numpy as np
import os

OUT_DIR = "/home/claude/projects/cartdex/public/icons/systems"

# ─────────────────────────────────────────────────────────────────────────────
# CORE DRAWING PRIMITIVES
# ─────────────────────────────────────────────────────────────────────────────

def new_canvas(size=64):
    """Transparent RGBA canvas."""
    return np.zeros((size, size, 4), dtype=np.uint8)

def px(canvas, x, y, color):
    """Set pixel if in bounds. color = (r,g,b,a)."""
    if 0 <= x < canvas.shape[1] and 0 <= y < canvas.shape[0]:
        canvas[y, x] = color

def hline(canvas, y, x0, x1, color):
    for x in range(x0, x1 + 1):
        px(canvas, x, y, color)

def vline(canvas, x, y0, y1, color):
    for y in range(y0, y1 + 1):
        px(canvas, x, y, color)

def rect(canvas, x0, y0, x1, y1, color):
    """Filled rectangle."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(canvas, x, y, color)

def rect_outline(canvas, x0, y0, x1, y1, color, thickness=1):
    for t in range(thickness):
        hline(canvas, y0 + t, x0 + t, x1 - t, color)
        hline(canvas, y1 - t, x0 + t, x1 - t, color)
        vline(canvas, x0 + t, y0 + t, y1 - t, color)
        vline(canvas, x1 - t, y0 + t, y1 - t, color)

def circle(canvas, cx, cy, r, color, fill=True):
    """Midpoint circle algorithm."""
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if fill:
                if dist <= r:
                    px(canvas, x, y, color)
            else:
                if abs(dist - r) < 0.7:
                    px(canvas, x, y, color)

def dither_rect(canvas, x0, y0, x1, y1, color_a, color_b, pattern="checker"):
    """
    Fill a rectangle with a dither pattern between two colors.
    Patterns: 'checker' (50/50), 'quarter_a' (25% b), 'quarter_b' (75% b),
              'h_bands', 'v_bands'
    """
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < canvas.shape[1] and 0 <= y < canvas.shape[0]:
                if pattern == "checker":
                    use_b = (x + y) % 2 == 1
                elif pattern == "quarter_a":
                    # 25% color_b: only when both x and y are odd
                    use_b = (x % 2 == 1) and (y % 2 == 1)
                elif pattern == "quarter_b":
                    # 75% color_b: only when both x and y are even
                    use_b = not ((x % 2 == 0) and (y % 2 == 0))
                elif pattern == "h_bands":
                    use_b = y % 2 == 1
                elif pattern == "v_bands":
                    use_b = x % 2 == 1
                else:
                    use_b = False
                canvas[y, x] = color_b if use_b else color_a

def gradient_rect(canvas, x0, y0, x1, y1, color_top, color_bot, dither=True):
    """
    Vertical gradient using dithering steps. Creates N bands.
    """
    height = y1 - y0 + 1
    if height <= 0:
        return
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(height - 1, 1)
        # Blend the two colors
        r = int(color_top[0] * (1 - t) + color_bot[0] * t)
        g = int(color_top[1] * (1 - t) + color_bot[1] * t)
        b = int(color_top[2] * (1 - t) + color_bot[2] * t)
        a = int(color_top[3] * (1 - t) + color_bot[3] * t)
        hline(canvas, y, x0, x1, (r, g, b, a))

def dither_gradient_rect(canvas, x0, y0, x1, y1, color_top, color_bot, steps=4):
    """
    Stepped dither gradient — banding like real 16-bit sprite shading.
    Divides region into 'steps' bands, dithers at boundaries.
    """
    height = y1 - y0 + 1
    band_h = height / steps
    for s in range(steps):
        by0 = y0 + int(s * band_h)
        by1 = y0 + int((s + 1) * band_h) - 1
        t0 = s / steps
        t1 = (s + 0.5) / steps
        # Color for this band
        r = int(color_top[0] * (1 - t0) + color_bot[0] * t0)
        g = int(color_top[1] * (1 - t0) + color_bot[1] * t0)
        b = int(color_top[2] * (1 - t0) + color_bot[2] * t0)
        c_main = (r, g, b, 255)
        r2 = int(color_top[0] * (1 - t1) + color_bot[0] * t1)
        g2 = int(color_top[1] * (1 - t1) + color_bot[1] * t1)
        b2 = int(color_top[2] * (1 - t1) + color_bot[2] * t1)
        c_next = (r2, g2, b2, 255)
        # Fill solid for most, dither last row
        for y in range(by0, by1):
            hline(canvas, y, x0, x1, c_main)
        # Dither the last row of this band
        if by1 <= y1:
            for x in range(x0, x1 + 1):
                use_next = (x % 2 == 0)
                canvas[by1, x] = c_next if use_next else c_main

def rounded_rect(canvas, x0, y0, x1, y1, color, corner=2):
    """Rounded rectangle fill."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            # Corner clipping
            in_bounds = True
            if x - x0 < corner and y - y0 < corner:
                in_bounds = (x - x0) + (y - y0) >= corner
            elif x1 - x < corner and y - y0 < corner:
                in_bounds = (x1 - x) + (y - y0) >= corner
            elif x - x0 < corner and y1 - y < corner:
                in_bounds = (x - x0) + (y1 - y) >= corner
            elif x1 - x < corner and y1 - y < corner:
                in_bounds = (x1 - x) + (y1 - y) >= corner
            if in_bounds:
                px(canvas, x, y, color)

def save_icon(canvas, slug, sizes=(32, 64)):
    """Save canvas as PNG at multiple sizes using nearest-neighbor."""
    img = Image.fromarray(canvas.astype(np.uint8), 'RGBA')
    for size in sizes:
        out = img.resize((size, size), Image.NEAREST)
        path = os.path.join(OUT_DIR, f"{slug}-{size}.png")
        out.save(path, optimize=True)
        print(f"  Saved {path}")

# ─────────────────────────────────────────────────────────────────────────────
# NES — Chunky 80s industrial grey/black brick
# Distinctive: top-loading slot, two red circle buttons, D-pad, black/grey
# ─────────────────────────────────────────────────────────────────────────────
def draw_nes():
    S = 64
    c = new_canvas(S)

    # Palette — NES grey industrial brick
    BLACK     = (15, 15, 18, 255)
    GREY_DARK = (80, 80, 85, 255)
    GREY_MID  = (128, 128, 133, 255)
    GREY_LT   = (175, 175, 180, 255)
    GREY_HI   = (210, 210, 215, 255)
    RED_BTN   = (200, 40, 40, 255)
    RED_DARK  = (130, 15, 15, 255)
    RED_HI    = (230, 80, 80, 255)

    # Main body — wide brick proportions
    # NES was a wide horizontal console, not a handheld
    # Draw as the face of the console looking head-on
    bx0, by0, bx1, by1 = 2, 14, 61, 52

    # Body fill with gradient (darker at bottom, lighter at top)
    dither_gradient_rect(c, bx0, by0, bx1, by1, GREY_MID, GREY_DARK, steps=5)

    # Top highlight strip — simulates light catching the flat plastic face
    hline(c, by0, bx0 + 1, bx1 - 1, GREY_HI)
    hline(c, by0 + 1, bx0 + 1, bx1 - 1, GREY_LT)

    # Body outline
    rect_outline(c, bx0, by0, bx1, by1, BLACK, 1)

    # Cartridge slot — the iconic top-loading slot on the face
    # NES face had a slot cover/door in the center top area
    slot_x0, slot_y0, slot_x1, slot_y1 = 18, by0 + 3, 45, by0 + 10
    rect(c, slot_x0, slot_y0, slot_x1, slot_y1, BLACK)
    hline(c, slot_y0, slot_x0, slot_x1, GREY_DARK)
    # Slot label lines (horizontal stripes = cartridge slot depth cue)
    for sy in range(slot_y0 + 2, slot_y1 - 1, 2):
        hline(c, sy, slot_x0 + 2, slot_x1 - 2, GREY_DARK)

    # D-pad — left side, classic NES plus-cross shape
    dp_cx, dp_cy = 17, 36
    # Horizontal bar
    rect(c, dp_cx - 5, dp_cy - 2, dp_cx + 5, dp_cy + 2, BLACK)
    # Vertical bar
    rect(c, dp_cx - 2, dp_cy - 5, dp_cx + 2, dp_cy + 5, BLACK)
    # D-pad face (lighter center and arms)
    rect(c, dp_cx - 4, dp_cy - 1, dp_cx + 4, dp_cy + 1, GREY_DARK)
    rect(c, dp_cx - 1, dp_cy - 4, dp_cx + 1, dp_cy + 4, GREY_DARK)
    # Center square
    rect(c, dp_cx - 1, dp_cy - 1, dp_cx + 1, dp_cy + 1, GREY_MID)

    # Start + Select buttons — center, two small dark rectangles
    for bx in [30, 38]:
        rect(c, bx - 3, 37, bx + 3, 39, BLACK)
        hline(c, 37, bx - 2, bx + 2, GREY_DARK)

    # A + B buttons — two red circle buttons on right
    for bpos, label in [(52, 'A'), (44, 'B')]:
        by = 35
        circle(c, bpos, by, 4, RED_DARK)
        circle(c, bpos, by, 3, RED_BTN)
        # Highlight
        px(c, bpos - 1, by - 2, RED_HI)
        px(c, bpos, by - 2, RED_HI)

    # Bottom edge — slightly darker, shadow effect
    hline(c, by1 - 1, bx0 + 1, bx1 - 1, GREY_DARK)
    hline(c, by1, bx0, bx1, BLACK)

    # Left vent slits (NES had vents on the side face — suggest them)
    for vy in [by0 + 15, by0 + 19, by0 + 23]:
        hline(c, vy, bx0 + 2, bx0 + 6, BLACK)
        hline(c, vy + 1, bx0 + 2, bx0 + 6, GREY_HI)

    save_icon(c, "nes")
    print("NES done")


# ─────────────────────────────────────────────────────────────────────────────
# SNES — Early-90s lavender/purple organic curves, colored face buttons
# Distinctive: rounded corners, ABXY colored buttons, shoulder bumps
# ─────────────────────────────────────────────────────────────────────────────
def draw_snes():
    S = 64
    c = new_canvas(S)

    # SNES USA palette — grey-purple lavender
    BLACK       = (15, 12, 20, 255)
    BODY_DARK   = (75, 68, 95, 255)
    BODY_MID    = (112, 100, 140, 255)
    BODY_LT     = (155, 140, 185, 255)
    BODY_HI     = (190, 178, 215, 255)
    PURPLE_DARK = (55, 45, 78, 255)
    # Button colors (SNES iconic)
    BTN_B       = (230, 190, 10, 255)    # yellow
    BTN_A       = (190, 30, 50, 255)     # red
    BTN_X       = (50, 90, 180, 255)     # blue
    BTN_Y       = (30, 160, 80, 255)     # green
    BTN_HI      = (255, 255, 255, 160)
    GREY_BTN    = (90, 85, 100, 255)
    GREY_START  = (60, 55, 75, 255)

    # Controller body — rounded organic shape
    # Wider in the middle, pinches slightly at grip handles
    bx0, by0, bx1, by1 = 3, 12, 60, 52

    # Base fill with gradient
    dither_gradient_rect(c, bx0, by0, bx1, by1, BODY_LT, BODY_DARK, steps=6)

    # Rounded corners
    for corner_x, corner_y in [(bx0, by0), (bx1, by0), (bx0, by1), (bx1, by1)]:
        corner_size = 4
        if corner_x == bx0 and corner_y == by0:
            for ox in range(corner_size):
                for oy in range(corner_size):
                    if ox + oy < corner_size:
                        c[corner_y + oy, corner_x + ox] = (0, 0, 0, 0)
        elif corner_x == bx1 and corner_y == by0:
            for ox in range(corner_size):
                for oy in range(corner_size):
                    if (corner_size - ox) + oy <= corner_size:
                        c[corner_y + oy, corner_x - ox] = (0, 0, 0, 0)
        elif corner_x == bx0 and corner_y == by1:
            for ox in range(corner_size):
                for oy in range(corner_size):
                    if ox + (corner_size - oy) <= corner_size:
                        c[corner_y - oy, corner_x + ox] = (0, 0, 0, 0)
        elif corner_x == bx1 and corner_y == by1:
            for ox in range(corner_size):
                for oy in range(corner_size):
                    if (corner_size - ox) + (corner_size - oy) <= corner_size:
                        c[corner_y - oy, corner_x - ox] = (0, 0, 0, 0)

    # Body outline (draw after transparency)
    for y in range(S):
        for x in range(S):
            if c[y, x, 3] > 0:
                # Check neighbors for outline
                for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
                    nx, ny = x+dx, y+dy
                    if 0 <= nx < S and 0 <= ny < S and c[ny, nx, 3] == 0:
                        pass  # will handle outline separately

    # Top highlight strip — catches overhead light
    hline(c, by0, bx0 + 4, bx1 - 4, BODY_HI)
    hline(c, by0 + 1, bx0 + 3, bx1 - 3, BODY_LT)
    hline(c, by0 + 2, bx0 + 3, bx1 - 3, BODY_MID)

    # Shoulder buttons (L and R) — bumps at top left and right
    # Left shoulder
    rect(c, bx0, by0 - 3, bx0 + 12, by0, BODY_MID)
    rect_outline(c, bx0, by0 - 3, bx0 + 12, by0, BLACK)
    hline(c, by0 - 3, bx0 + 1, bx0 + 11, BODY_HI)
    # Right shoulder
    rect(c, bx1 - 12, by0 - 3, bx1, by0, BODY_MID)
    rect_outline(c, bx1 - 12, by0 - 3, bx1, by0, BLACK)
    hline(c, by0 - 3, bx1 - 11, bx1 - 1, BODY_HI)

    # Center face plate — recessed dark panel in the middle
    cx0, cy0, cx1, cy1 = 18, 20, 45, 40
    rect(c, cx0, cy0, cx1, cy1, PURPLE_DARK)
    rect_outline(c, cx0, cy0, cx1, cy1, BLACK)

    # D-pad — left, SNES cross shape
    dp_cx, dp_cy = 14, 32
    dpad_color = (55, 50, 70, 255)
    dpad_hi = (80, 75, 100, 255)
    rect(c, dp_cx - 5, dp_cy - 2, dp_cx + 5, dp_cy + 2, BLACK)
    rect(c, dp_cx - 2, dp_cy - 5, dp_cx + 2, dp_cy + 5, BLACK)
    rect(c, dp_cx - 4, dp_cy - 1, dp_cx + 4, dp_cy + 1, dpad_color)
    rect(c, dp_cx - 1, dp_cy - 4, dp_cx + 1, dp_cy + 4, dpad_color)
    hline(c, dp_cy - 4, dp_cx - 1, dp_cx + 1, dpad_hi)
    px(c, dp_cx - 4, dp_cy, dpad_hi)

    # Start / Select — two pill-shaped buttons in center
    for btn_x in [29, 35]:
        rect(c, btn_x - 2, 33, btn_x + 2, 35, GREY_START)
        rect_outline(c, btn_x - 2, 33, btn_x + 2, 35, BLACK)
        px(c, btn_x - 1, 33, BODY_MID)

    # ABXY colored buttons — right side diamond layout
    btn_cx, btn_cy = 49, 29
    # B (bottom) - yellow
    circle(c, btn_cx, btn_cy + 4, 3, BLACK)
    circle(c, btn_cx, btn_cy + 4, 2, BTN_B)
    px(c, btn_cx - 1, btn_cy + 3, (255, 220, 80, 255))
    # A (right) - red
    circle(c, btn_cx + 4, btn_cy, 3, BLACK)
    circle(c, btn_cx + 4, btn_cy, 2, BTN_A)
    px(c, btn_cx + 3, btn_cy - 1, (230, 80, 80, 255))
    # X (top) - blue
    circle(c, btn_cx, btn_cy - 4, 3, BLACK)
    circle(c, btn_cx, btn_cy - 4, 2, BTN_X)
    px(c, btn_cx - 1, btn_cy - 5, (100, 140, 220, 255))
    # Y (left) - green
    circle(c, btn_cx - 4, btn_cy, 3, BLACK)
    circle(c, btn_cx - 4, btn_cy, 2, BTN_Y)
    px(c, btn_cx - 5, btn_cy - 1, (80, 200, 120, 255))

    # Bottom grip handles — dither to suggest grip curvature
    dither_rect(c, bx0 + 2, by1 - 8, bx0 + 10, by1 - 2, BODY_DARK, BODY_MID, "checker")
    dither_rect(c, bx1 - 10, by1 - 8, bx1 - 2, by1 - 2, BODY_DARK, BODY_MID, "checker")

    # Outline the whole shape
    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    save_icon(c, "snes")
    print("SNES done")


# ─────────────────────────────────────────────────────────────────────────────
# N64 — Trident grip, cartridge slot top, 64 logo colors
# Distinctive: 3-prong handle, analog stick, grey/black with colorful logo
# ─────────────────────────────────────────────────────────────────────────────
def draw_n64():
    S = 64
    c = new_canvas(S)

    BLACK     = (10, 10, 12, 255)
    BODY_DARK = (65, 60, 70, 255)
    BODY_MID  = (100, 95, 108, 255)
    BODY_LT   = (145, 140, 155, 255)
    BODY_HI   = (185, 180, 195, 255)
    RED_N64   = (205, 30, 30, 255)
    BLUE_N64  = (20, 60, 190, 255)
    GREEN_N64 = (25, 155, 60, 255)
    YELLOW_N64= (220, 185, 10, 255)
    GREY_BTN  = (75, 70, 85, 255)

    # N64 body — the iconic trident/M-shape top with middle prong
    # Draw the main body mass
    # Center body
    rect(c, 16, 12, 48, 40, BODY_MID)
    # Left handle prong
    rect(c, 4, 22, 20, 52, BODY_MID)
    # Right handle prong
    rect(c, 44, 22, 60, 52, BODY_MID)
    # Center prong (bottom middle)
    rect(c, 24, 38, 40, 52, BODY_MID)

    # Gradient overlays on body sections
    dither_gradient_rect(c, 16, 12, 48, 40, BODY_LT, BODY_DARK, steps=5)
    dither_gradient_rect(c, 4, 22, 20, 52, BODY_LT, BODY_DARK, steps=4)
    dither_gradient_rect(c, 44, 22, 60, 52, BODY_LT, BODY_DARK, steps=4)
    dither_gradient_rect(c, 24, 38, 40, 52, BODY_MID, BODY_DARK, steps=3)

    # Top highlight on main body
    hline(c, 12, 17, 47, BODY_HI)
    hline(c, 13, 17, 47, BODY_LT)

    # Cartridge slot on top (N64 top-loading)
    slot_x0, slot_y0, slot_x1, slot_y1 = 22, 12, 42, 17
    rect(c, slot_x0, slot_y0, slot_x1, slot_y1, BLACK)
    hline(c, slot_y0, slot_x0 + 1, slot_x1 - 1, BODY_DARK)

    # Outlines — body sections
    rect_outline(c, 16, 12, 48, 40, BLACK)
    rect_outline(c, 4, 22, 20, 52, BLACK)
    rect_outline(c, 44, 22, 60, 52, BLACK)
    rect_outline(c, 24, 38, 40, 52, BLACK)

    # Analog stick — left handle, distinctive N64 feature
    circle(c, 12, 30, 4, BLACK)
    circle(c, 12, 30, 3, BODY_DARK)
    circle(c, 12, 30, 2, BODY_MID)
    px(c, 11, 29, BODY_HI)

    # D-pad — right side of center body, small
    dp_cx, dp_cy = 36, 28
    rect(c, dp_cx - 3, dp_cy - 1, dp_cx + 3, dp_cy + 1, BLACK)
    rect(c, dp_cx - 1, dp_cy - 3, dp_cx + 1, dp_cy + 3, BLACK)
    rect(c, dp_cx - 2, dp_cy - 1, dp_cx + 2, dp_cy + 1, GREY_BTN)
    rect(c, dp_cx - 1, dp_cy - 2, dp_cx + 1, dp_cy + 2, GREY_BTN)

    # C-buttons — yellow row (N64 distinctive yellow C-pad)
    c_y = 25
    for i, cx_pos in enumerate([43, 50, 50, 57]):
        c_cy = c_y if i != 1 else c_y - 4
        c_cy = c_y if i != 2 else c_y + 4
        if i == 0: cx_pos, c_cy = 47, c_y
        elif i == 1: cx_pos, c_cy = 53, c_y - 4
        elif i == 2: cx_pos, c_cy = 53, c_y + 4
        elif i == 3: cx_pos, c_cy = 59, c_y
        circle(c, cx_pos, c_cy, 2, BLACK)
        circle(c, cx_pos, c_cy, 1, YELLOW_N64)

    # A button (right handle) — large green circle
    circle(c, 52, 32, 4, BLACK)
    circle(c, 52, 32, 3, GREEN_N64)
    px(c, 51, 31, (70, 200, 100, 255))

    # B button — smaller red
    circle(c, 46, 37, 3, BLACK)
    circle(c, 46, 37, 2, RED_N64)
    px(c, 45, 36, (240, 80, 80, 255))

    # Z trigger on bottom of center prong — dark bar
    rect(c, 26, 48, 38, 51, BLACK)
    rect(c, 27, 49, 37, 50, BODY_DARK)

    # Start button — center circle
    circle(c, 32, 28, 3, BLACK)
    circle(c, 32, 28, 2, (110, 100, 120, 255))
    px(c, 31, 27, BODY_HI)

    save_icon(c, "n64")
    print("N64 done")


# ─────────────────────────────────────────────────────────────────────────────
# GB — Original Game Boy, mid-80s monochrome, cream/off-white, green screen
# Distinctive: tall portrait brick, dot-matrix screen, D-cross, two red buttons
# ─────────────────────────────────────────────────────────────────────────────
def draw_gb():
    S = 64
    c = new_canvas(S)

    BLACK      = (10, 10, 10, 255)
    CREAM      = (200, 195, 178, 255)
    CREAM_DARK = (160, 155, 138, 255)
    CREAM_MID  = (180, 175, 158, 255)
    CREAM_HI   = (220, 216, 200, 255)
    SCREEN_GRN = (104, 138, 72, 255)  # Classic GB green
    SCR_HI     = (140, 175, 100, 255)
    SCR_DARK   = (65, 95, 45, 255)
    SCR_DARKST = (32, 55, 20, 255)    # Darkest pixel "ink"
    RED_BTN    = (195, 45, 45, 255)
    RED_DARK   = (130, 15, 15, 255)
    RED_HI     = (230, 85, 85, 255)
    GREY_BTN   = (130, 125, 115, 255)
    DARK_STRIP = (80, 75, 65, 255)

    # Portrait-orientation body
    bx0, by0, bx1, by1 = 10, 2, 53, 61
    dither_gradient_rect(c, bx0, by0, bx1, by1, CREAM_HI, CREAM_DARK, steps=6)
    hline(c, by0, bx0 + 1, bx1 - 1, CREAM_HI)

    # Bottom corners are clipped on original GB
    for ox in range(3):
        for oy in range(3):
            if ox + oy < 3:
                px(c, bx0 + ox, by1 - oy, (0,0,0,0))
                px(c, bx1 - ox, by1 - oy, (0,0,0,0))

    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    # Screen bezel — recessed dark panel
    bz_x0, bz_y0, bz_x1, bz_y1 = 13, 5, 50, 35
    rect(c, bz_x0, bz_y0, bz_x1, bz_y1, DARK_STRIP)
    rect_outline(c, bz_x0, bz_y0, bz_x1, bz_y1, BLACK)

    # Screen — the iconic green dot-matrix LCD
    sc_x0, sc_y0, sc_x1, sc_y1 = 15, 7, 48, 32
    # Background green
    rect(c, sc_x0, sc_y0, sc_x1, sc_y1, SCREEN_GRN)
    # Screen gradient — slightly lighter at top
    for sy in range(sc_y0, sc_y0 + 4):
        hline(c, sy, sc_x0, sc_x1, SCR_HI)
    dither_rect(c, sc_x0, sc_y0 + 4, sc_x1, sc_y0 + 6, SCR_HI, SCREEN_GRN, "checker")
    # Dark border inside screen
    rect_outline(c, sc_x0, sc_y0, sc_x1, sc_y1, SCR_DARKST)

    # Dot-matrix pixel grid suggestion (3x3 pixel clusters with gaps)
    for gy in range(sc_y0 + 3, sc_y1 - 3, 4):
        for gx in range(sc_x0 + 3, sc_x1 - 3, 4):
            px(c, gx, gy, SCR_DARK)

    # Battery/power LED dot
    px(c, bz_x1 - 3, bz_y0 + 2, (220, 50, 50, 255))
    px(c, bz_x1 - 3, bz_y0 + 3, (180, 20, 20, 255))

    # "DOT MATRIX WITH STEREO SOUND" label suggestion (tiny horizontal lines)
    hline(c, bz_y1 - 3, bz_x0 + 3, bz_x0 + 18, CREAM_DARK)
    hline(c, bz_y1 - 1, bz_x0 + 3, bz_x0 + 14, CREAM_DARK)

    # D-pad — below screen, left
    dp_cx, dp_cy = 20, 46
    rect(c, dp_cx - 5, dp_cy - 2, dp_cx + 5, dp_cy + 2, BLACK)
    rect(c, dp_cx - 2, dp_cy - 5, dp_cx + 2, dp_cy + 5, BLACK)
    rect(c, dp_cx - 4, dp_cy - 1, dp_cx + 4, dp_cy + 1, GREY_BTN)
    rect(c, dp_cx - 1, dp_cy - 4, dp_cx + 1, dp_cy + 4, GREY_BTN)
    rect(c, dp_cx - 1, dp_cy - 1, dp_cx + 1, dp_cy + 1, CREAM_MID)
    hline(c, dp_cy - 4, dp_cx - 1, dp_cx + 1, CREAM_HI)

    # Select / Start — center, two small dark bars
    for bx in [29, 35]:
        rect(c, bx - 2, 50, bx + 2, 51, DARK_STRIP)
        px(c, bx - 1, 50, GREY_BTN)

    # A + B buttons — right side, diagonal red circles
    circle(c, 43, 42, 4, RED_DARK)
    circle(c, 43, 42, 3, RED_BTN)
    px(c, 42, 41, RED_HI)

    circle(c, 36, 45, 4, RED_DARK)
    circle(c, 36, 45, 3, RED_BTN)
    px(c, 35, 44, RED_HI)

    # Speaker grill — bottom right, dot pattern
    for gy in range(54, 59, 2):
        for gx in range(40, 52, 2):
            px(c, gx, gy, CREAM_DARK)
            px(c, gx, gy + 1, CREAM)

    save_icon(c, "gb")
    print("GB done")


# ─────────────────────────────────────────────────────────────────────────────
# GBC — Game Boy Color, late-90s translucent purple/teal palette
# Distinctive: slightly sleeker than GB, color splash, infrared port top
# ─────────────────────────────────────────────────────────────────────────────
def draw_gbc():
    S = 64
    c = new_canvas(S)

    BLACK      = (10, 10, 10, 255)
    # GBC atomic purple colorway (most iconic)
    BODY_DARK  = (70, 40, 110, 255)
    BODY_MID   = (110, 65, 160, 255)
    BODY_LT    = (155, 100, 205, 255)
    BODY_HI    = (190, 140, 230, 255)
    # The screen
    SCR_BG     = (20, 18, 35, 255)
    SCR_LT     = (80, 120, 200, 255)
    SCR_GLOW   = (130, 180, 230, 255)
    # Buttons — GBC had multicolor buttons
    BTN_A      = (195, 30, 40, 255)
    BTN_B      = (190, 30, 40, 255)
    BTN_A_HI   = (230, 80, 80, 255)
    DARK_STRIP = (40, 25, 65, 255)
    GREY_BTN   = (120, 95, 150, 255)
    IR_PORT    = (65, 30, 30, 255)

    # Portrait body — slightly rounder than GB
    bx0, by0, bx1, by1 = 11, 2, 52, 61
    dither_gradient_rect(c, bx0, by0, bx1, by1, BODY_LT, BODY_DARK, steps=6)
    hline(c, by0, bx0 + 2, bx1 - 2, BODY_HI)
    hline(c, by0 + 1, bx0 + 1, bx1 - 1, BODY_LT)

    # Rounded top corners
    px(c, bx0, by0, (0,0,0,0))
    px(c, bx0 + 1, by0, (0,0,0,0))
    px(c, bx0, by0 + 1, (0,0,0,0))
    px(c, bx1, by0, (0,0,0,0))
    px(c, bx1 - 1, by0, (0,0,0,0))
    px(c, bx1, by0 + 1, (0,0,0,0))

    # Infrared port on top
    rect(c, 28, 2, 35, 4, IR_PORT)
    rect_outline(c, 28, 2, 35, 4, BLACK)
    hline(c, 3, 29, 34, (100, 50, 50, 255))

    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    # Screen bezel
    bz_x0, bz_y0, bz_x1, bz_y1 = 13, 6, 50, 34
    rect(c, bz_x0, bz_y0, bz_x1, bz_y1, DARK_STRIP)
    rect_outline(c, bz_x0, bz_y0, bz_x1, bz_y1, BLACK)

    # Screen — backlit look for GBC (slightly brighter)
    sc_x0, sc_y0, sc_x1, sc_y1 = 15, 8, 48, 32
    rect(c, sc_x0, sc_y0, sc_x1, sc_y1, SCR_BG)
    # Color gradient — GBC had vivid backlit colors
    dither_gradient_rect(c, sc_x0, sc_y0, sc_x1, sc_y1, SCR_GLOW, SCR_BG, steps=4)
    # Top-left highlight (light source)
    for hy in range(sc_y0, sc_y0 + 6):
        for hx in range(sc_x0, sc_x0 + 8):
            if hx - sc_x0 + hy - sc_y0 < 8:
                blend = 1.0 - (hx - sc_x0 + hy - sc_y0) / 8.0
                existing = c[hy, hx].copy()
                c[hy, hx] = (
                    int(existing[0] * (1-blend*0.5) + 200 * blend * 0.5),
                    int(existing[1] * (1-blend*0.5) + 220 * blend * 0.5),
                    int(existing[2] * (1-blend*0.5) + 255 * blend * 0.5),
                    255
                )
    rect_outline(c, sc_x0, sc_y0, sc_x1, sc_y1, BLACK)

    # Power LED
    px(c, bz_x1 - 2, bz_y0 + 2, (255, 60, 60, 255))

    # D-pad
    dp_cx, dp_cy = 21, 46
    rect(c, dp_cx - 5, dp_cy - 2, dp_cx + 5, dp_cy + 2, BLACK)
    rect(c, dp_cx - 2, dp_cy - 5, dp_cx + 2, dp_cy + 5, BLACK)
    rect(c, dp_cx - 4, dp_cy - 1, dp_cx + 4, dp_cy + 1, GREY_BTN)
    rect(c, dp_cx - 1, dp_cy - 4, dp_cx + 1, dp_cy + 4, GREY_BTN)
    hline(c, dp_cy - 4, dp_cx - 1, dp_cx + 1, BODY_HI)

    # Select / Start
    for bx in [29, 36]:
        rect(c, bx - 2, 50, bx + 2, 51, DARK_STRIP)
        px(c, bx - 1, 50, GREY_BTN)

    # A + B buttons — red diagonal
    circle(c, 44, 42, 4, BLACK)
    circle(c, 44, 42, 3, BTN_A)
    px(c, 43, 41, BTN_A_HI)

    circle(c, 37, 46, 4, BLACK)
    circle(c, 37, 46, 3, BTN_B)
    px(c, 36, 45, BTN_A_HI)

    # Speaker grill — bottom right dots
    for gy in range(54, 60, 2):
        for gx in range(40, 51, 2):
            px(c, gx, gy, BODY_DARK)

    save_icon(c, "gbc")
    print("GBC done")


# ─────────────────────────────────────────────────────────────────────────────
# GBA — Game Boy Advance, 2001 sleek horizontal form factor
# Distinctive: LANDSCAPE orientation, shoulder bumps, colored ABXY
# ─────────────────────────────────────────────────────────────────────────────
def draw_gba():
    S = 64
    c = new_canvas(S)

    BLACK      = (10, 10, 10, 255)
    # GBA indigo/midnight blue colorway (most iconic)
    BODY_DARK  = (30, 28, 55, 255)
    BODY_MID   = (55, 50, 95, 255)
    BODY_LT    = (85, 78, 138, 255)
    BODY_HI    = (120, 112, 175, 255)
    # Screen
    SCR_DARK   = (25, 22, 40, 255)
    SCR_GLOW   = (60, 100, 160, 255)
    # Buttons
    BTN_A      = (190, 30, 50, 255)
    BTN_B      = (190, 30, 50, 255)
    BTN_A_HI   = (230, 80, 80, 255)
    GREY_DPAD  = (70, 65, 90, 255)
    DARK_BEVEL = (20, 18, 38, 255)

    # LANDSCAPE body — wider than tall
    bx0, by0, bx1, by1 = 2, 14, 61, 50
    dither_gradient_rect(c, bx0, by0, bx1, by1, BODY_LT, BODY_DARK, steps=5)
    hline(c, by0, bx0 + 2, bx1 - 2, BODY_HI)
    hline(c, by0 + 1, bx0 + 2, bx1 - 2, BODY_LT)

    # Rounded corners
    for corner in [(bx0, by0, 1, 1), (bx1, by0, -1, 1), (bx0, by1, 1, -1), (bx1, by1, -1, -1)]:
        cx, cy, dx, dy = corner
        for r in range(3):
            px(c, cx + dx*r, cy, (0,0,0,0))
            px(c, cx, cy + dy*r, (0,0,0,0))
        px(c, cx + dx, cy + dy, (0,0,0,0))

    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    # Shoulder buttons — top left and right tabs
    rect(c, bx0, by0 - 4, bx0 + 14, by0, BODY_MID)
    rect_outline(c, bx0, by0 - 4, bx0 + 14, by0, BLACK)
    hline(c, by0 - 4, bx0 + 1, bx0 + 13, BODY_HI)

    rect(c, bx1 - 14, by0 - 4, bx1, by0, BODY_MID)
    rect_outline(c, bx1 - 14, by0 - 4, bx1, by0, BLACK)
    hline(c, by0 - 4, bx1 - 13, bx1 - 1, BODY_HI)

    # Screen — centered, horizontal
    sc_x0, sc_y0, sc_x1, sc_y1 = 17, 18, 46, 46
    # Bezel
    rect(c, sc_x0 - 2, sc_y0 - 2, sc_x1 + 2, sc_y1 + 2, DARK_BEVEL)
    rect_outline(c, sc_x0 - 2, sc_y0 - 2, sc_x1 + 2, sc_y1 + 2, BLACK)
    # Screen face
    rect(c, sc_x0, sc_y0, sc_x1, sc_y1, SCR_DARK)
    dither_gradient_rect(c, sc_x0, sc_y0, sc_x1, sc_y1, SCR_GLOW, SCR_DARK, steps=4)
    # Highlight corner
    for hy in range(sc_y0, sc_y0 + 5):
        for hx in range(sc_x0, sc_x0 + 7):
            if hx - sc_x0 + hy - sc_y0 < 6:
                existing = c[hy, hx].copy()
                c[hy, hx] = (
                    min(255, existing[0] + 40),
                    min(255, existing[1] + 50),
                    min(255, existing[2] + 60),
                    255
                )
    rect_outline(c, sc_x0, sc_y0, sc_x1, sc_y1, BLACK)

    # D-pad — left side
    dp_cx, dp_cy = 9, 35
    rect(c, dp_cx - 4, dp_cy - 2, dp_cx + 4, dp_cy + 2, BLACK)
    rect(c, dp_cx - 2, dp_cy - 4, dp_cx + 2, dp_cy + 4, BLACK)
    rect(c, dp_cx - 3, dp_cy - 1, dp_cx + 3, dp_cy + 1, GREY_DPAD)
    rect(c, dp_cx - 1, dp_cy - 3, dp_cx + 1, dp_cy + 3, GREY_DPAD)
    px(c, dp_cx - 3, dp_cy, BODY_HI)
    px(c, dp_cx, dp_cy - 3, BODY_HI)

    # A and B buttons — right side
    circle(c, 56, 28, 4, BLACK)
    circle(c, 56, 28, 3, BTN_A)
    px(c, 55, 27, BTN_A_HI)

    circle(c, 50, 34, 4, BLACK)
    circle(c, 50, 34, 3, BTN_B)
    px(c, 49, 33, BTN_A_HI)

    # Select + Start — two small buttons in center
    for bx in [26, 33]:
        rect(c, bx - 2, 44, bx + 2, 46, DARK_BEVEL)
        rect_outline(c, bx - 2, 44, bx + 2, 46, BLACK)
        px(c, bx - 1, 44, BODY_MID)

    # Power LED
    px(c, 5, 20, (255, 80, 80, 255))
    px(c, 5, 21, (180, 30, 30, 255))

    save_icon(c, "gba")
    print("GBA done")


# ─────────────────────────────────────────────────────────────────────────────
# Genesis — Sleek black 90s tech-noir, sharp angles, red accent
# Distinctive: black slab, model 1 has "SEGA" lettering zone, red button A
# ─────────────────────────────────────────────────────────────────────────────
def draw_genesis():
    S = 64
    c = new_canvas(S)

    BLACK      = (8, 8, 10, 255)
    BODY_NEAR  = (28, 28, 32, 255)  # Very dark — Genesis was BLACK
    BODY_MID   = (48, 48, 55, 255)
    BODY_LT    = (75, 75, 85, 255)
    BODY_HI    = (108, 108, 120, 255)
    BODY_SPEC  = (140, 140, 155, 255)  # Specular highlight
    RED_A      = (210, 35, 35, 255)
    RED_A_DARK = (140, 15, 15, 255)
    RED_A_HI   = (245, 90, 90, 255)
    BLUE_C     = (40, 80, 190, 255)
    GREY_BC    = (80, 80, 95, 255)

    # Main controller body — 3-button Genesis (Model 1 Mega Drive style)
    # Very dark, slightly rounded, horizontal
    bx0, by0, bx1, by1 = 3, 16, 60, 50

    # Dark body — near black with slight gradient
    dither_gradient_rect(c, bx0, by0, bx1, by1, BODY_MID, BODY_NEAR, steps=4)

    # Top specular — sharp highlight from light above (shiny plastic)
    hline(c, by0, bx0 + 2, bx1 - 2, BODY_SPEC)
    hline(c, by0 + 1, bx0 + 2, bx1 - 2, BODY_HI)
    hline(c, by0 + 2, bx0 + 2, bx1 - 2, BODY_LT)
    # Dither edge of highlight
    dither_rect(c, bx0 + 2, by0 + 3, bx1 - 2, by0 + 4, BODY_MID, BODY_LT, "checker")

    # D-pad — left side, dark cross on dark background
    dp_cx, dp_cy = 16, 35
    rect(c, dp_cx - 5, dp_cy - 2, dp_cx + 5, dp_cy + 2, BLACK)
    rect(c, dp_cx - 2, dp_cy - 5, dp_cx + 2, dp_cy + 5, BLACK)
    rect(c, dp_cx - 4, dp_cy - 1, dp_cx + 4, dp_cy + 1, BODY_MID)
    rect(c, dp_cx - 1, dp_cy - 4, dp_cx + 1, dp_cy + 4, BODY_MID)
    # Highlight top-left of dpad
    px(c, dp_cx - 4, dp_cy, BODY_HI)
    px(c, dp_cx, dp_cy - 4, BODY_HI)
    # Center
    rect(c, dp_cx - 1, dp_cy - 1, dp_cx + 1, dp_cy + 1, BODY_LT)

    # Start button — center
    circle(c, 32, 33, 3, BLACK)
    circle(c, 32, 33, 2, BODY_MID)
    px(c, 31, 32, BODY_HI)

    # A, B, C buttons — three-button layout (Genesis was ABC not ABXY)
    # A = left, red (iconic)
    circle(c, 43, 38, 4, BLACK)
    circle(c, 43, 38, 3, RED_A_DARK)
    circle(c, 43, 38, 2, RED_A)
    px(c, 42, 37, RED_A_HI)

    # B = center, grey
    circle(c, 50, 33, 4, BLACK)
    circle(c, 50, 33, 3, GREY_BC)
    px(c, 49, 32, BODY_HI)

    # C = right, grey
    circle(c, 56, 28, 4, BLACK)
    circle(c, 56, 28, 3, GREY_BC)
    px(c, 55, 27, BODY_HI)

    # Cable exit — bottom center (suggest the wire)
    rect(c, 28, by1, 36, by1 + 4, BLACK)
    hline(c, by1, 29, 35, BODY_NEAR)

    # Mode button — small dark bump near start
    rect(c, 36, 30, 40, 32, BLACK)
    px(c, 37, 30, BODY_NEAR)

    # Body outline
    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    # Shadow under body
    dither_rect(c, bx0 + 2, by1 + 1, bx1 - 2, by1 + 2, (0,0,0,60), (0,0,0,0), "checker")

    save_icon(c, "genesis")
    print("Genesis done")


# ─────────────────────────────────────────────────────────────────────────────
# Master System — 80s Sega, red/white/black card slot, chunky buttons
# Distinctive: black/dark red body, card slot on side, two red buttons
# ─────────────────────────────────────────────────────────────────────────────
def draw_mastersystem():
    S = 64
    c = new_canvas(S)

    BLACK      = (10, 10, 10, 255)
    BODY_DARK  = (30, 25, 25, 255)
    BODY_MID   = (55, 48, 48, 255)
    BODY_LT    = (82, 75, 75, 255)
    BODY_HI    = (115, 108, 108, 255)
    RED_ACCENT = (195, 35, 25, 255)
    RED_DARK   = (130, 15, 10, 255)
    RED_HI     = (230, 80, 70, 255)
    WHITE_TRIM = (210, 205, 200, 255)
    GREY_BTN   = (90, 85, 85, 255)

    # Controller body — SMS controller, very boxy 80s style
    bx0, by0, bx1, by1 = 3, 18, 60, 48

    dither_gradient_rect(c, bx0, by0, bx1, by1, BODY_LT, BODY_DARK, steps=4)

    # Top specular
    hline(c, by0, bx0 + 1, bx1 - 1, BODY_HI)
    hline(c, by0 + 1, bx0 + 1, bx1 - 1, BODY_LT)

    # Red stripe — the iconic SMS horizontal red band
    stripe_y = by0 + 8
    rect(c, bx0 + 1, stripe_y, bx1 - 1, stripe_y + 3, RED_DARK)
    hline(c, stripe_y, bx0 + 1, bx1 - 1, RED_ACCENT)
    hline(c, stripe_y + 1, bx0 + 1, bx1 - 1, RED_ACCENT)
    hline(c, stripe_y + 2, bx0 + 1, bx1 - 1, RED_DARK)
    hline(c, stripe_y + 3, bx0 + 1, bx1 - 1, (80, 10, 5, 255))

    # D-pad — left side
    dp_cx, dp_cy = 16, 38
    rect(c, dp_cx - 5, dp_cy - 2, dp_cx + 5, dp_cy + 2, BLACK)
    rect(c, dp_cx - 2, dp_cy - 5, dp_cx + 2, dp_cy + 5, BLACK)
    rect(c, dp_cx - 4, dp_cy - 1, dp_cx + 4, dp_cy + 1, GREY_BTN)
    rect(c, dp_cx - 1, dp_cy - 4, dp_cx + 1, dp_cy + 4, GREY_BTN)
    hline(c, dp_cy - 4, dp_cx - 1, dp_cx + 1, BODY_HI)

    # 1 and 2 buttons — right side, the SMS had TWO buttons (1 and 2)
    # Large red hexagonal buttons — very 80s
    for btn_x, btn_y in [(46, 32), (55, 32)]:
        # Hexagonal feel — use rounded rect
        rect(c, btn_x - 4, btn_y - 4, btn_x + 4, btn_y + 4, BLACK)
        rect(c, btn_x - 3, btn_y - 4, btn_x + 3, btn_y + 4, RED_DARK)
        rect(c, btn_x - 4, btn_y - 3, btn_x + 4, btn_y + 3, RED_DARK)
        rect(c, btn_x - 3, btn_y - 3, btn_x + 3, btn_y + 3, RED_ACCENT)
        # Highlight
        px(c, btn_x - 2, btn_y - 2, RED_HI)
        px(c, btn_x - 1, btn_y - 2, RED_HI)

    # Pause button — center top, small
    rect(c, 28, 22, 35, 24, BLACK)
    rect(c, 29, 22, 34, 24, GREY_BTN)
    px(c, 29, 22, BODY_HI)

    # White trim strip at the very top of body
    hline(c, by0, bx0 + 1, bx1 - 1, WHITE_TRIM)

    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    save_icon(c, "mastersystem")
    print("Master System done")


# ─────────────────────────────────────────────────────────────────────────────
# Arcade — Cabinet silhouette, marquee, CRT screen, joystick + buttons
# Distinctive: upright cabinet shape with marquee glow, joystick, 2-3 buttons
# ─────────────────────────────────────────────────────────────────────────────
def draw_arcade():
    S = 64
    c = new_canvas(S)

    BLACK      = (8, 8, 10, 255)
    CABINET    = (35, 30, 28, 255)
    CAB_MID    = (55, 48, 44, 255)
    CAB_LT     = (80, 72, 66, 255)
    CAB_HI     = (112, 102, 94, 255)
    MARQUEE    = (255, 180, 20, 255)    # Glowing amber/gold marquee
    MAR_GLOW   = (255, 220, 120, 255)
    MAR_DARK   = (180, 110, 10, 255)
    SCREEN_GRN = (10, 200, 80, 255)    # Classic green phosphor CRT
    SCR_DARK   = (5, 80, 30, 255)
    SCR_HI     = (100, 255, 160, 255)
    BTN_RED    = (200, 30, 30, 255)
    BTN_BLUE   = (30, 60, 200, 255)
    BTN_WHITE  = (200, 200, 200, 255)
    STICK      = (40, 35, 32, 255)
    STICK_HI   = (90, 82, 78, 255)

    # Cabinet body — upright shape
    # Wider at top (marquee/screen), slight taper at control panel area
    cab_x0, cab_y0 = 10, 2
    cab_x1, cab_y1 = 54, 61

    # Body fill
    dither_gradient_rect(c, cab_x0, cab_y0, cab_x1, cab_y1, CAB_MID, CABINET, steps=5)

    # Side highlight (cabinet has a bevel/edge on the left side)
    vline(c, cab_x0, cab_y0, cab_y1, CAB_HI)
    vline(c, cab_x0 + 1, cab_y0, cab_y1, CAB_LT)
    dither_rect(c, cab_x0 + 2, cab_y0, cab_x0 + 3, cab_y1, CAB_MID, CAB_LT, "checker")

    # Marquee — glowing light box at top
    mar_y0, mar_y1 = cab_y0, cab_y0 + 9
    rect(c, cab_x0 + 1, mar_y0, cab_x1 - 1, mar_y1, MAR_DARK)
    rect(c, cab_x0 + 2, mar_y0 + 1, cab_x1 - 2, mar_y1 - 1, MARQUEE)
    # Glow in center
    rect(c, cab_x0 + 5, mar_y0 + 1, cab_x1 - 5, mar_y1 - 2, MAR_GLOW)
    # Marquee horizontal stripes (backlit panel look)
    hline(c, mar_y0 + 2, cab_x0 + 3, cab_x1 - 3, MAR_GLOW)
    hline(c, mar_y0 + 4, cab_x0 + 3, cab_x1 - 3, MARQUEE)
    hline(c, mar_y0 + 6, cab_x0 + 3, cab_x1 - 3, MAR_DARK)

    # CRT screen — green phosphor glow
    sc_x0, sc_y0, sc_x1, sc_y1 = cab_x0 + 4, mar_y1 + 3, cab_x1 - 4, mar_y1 + 26
    rect(c, sc_x0 - 1, sc_y0 - 1, sc_x1 + 1, sc_y1 + 1, BLACK)
    rect(c, sc_x0, sc_y0, sc_x1, sc_y1, SCR_DARK)
    dither_gradient_rect(c, sc_x0, sc_y0, sc_x1, sc_y1, SCREEN_GRN, SCR_DARK, steps=5)
    # Scanlines suggestion (every other row slightly darker)
    for sy in range(sc_y0 + 1, sc_y1 - 1, 2):
        for sx in range(sc_x0, sc_x1 + 1):
            existing = c[sy, sx].copy()
            c[sy, sx] = (
                int(existing[0] * 0.75),
                int(existing[1] * 0.75),
                int(existing[2] * 0.75),
                255
            )
    # Screen highlight (CRT curved glass reflection)
    for hy in range(sc_y0, sc_y0 + 5):
        for hx in range(sc_x0, sc_x0 + 8):
            if hx - sc_x0 + hy - sc_y0 < 7:
                existing = c[hy, hx].copy()
                blend = (7 - (hx - sc_x0 + hy - sc_y0)) / 7.0 * 0.4
                c[hy, hx] = (
                    min(255, int(existing[0] + 100 * blend)),
                    min(255, int(existing[1] + 255 * blend)),
                    min(255, int(existing[2] + 150 * blend)),
                    255
                )
    rect_outline(c, sc_x0, sc_y0, sc_x1, sc_y1, BLACK)

    # Control panel — bottom section
    cp_y0 = sc_y1 + 4
    rect(c, cab_x0 + 1, cp_y0, cab_x1 - 1, cab_y1, CAB_MID)
    rect_outline(c, cab_x0 + 1, cp_y0, cab_x1 - 1, cab_y1, BLACK)
    hline(c, cp_y0, cab_x0 + 2, cab_x1 - 2, CAB_HI)

    # Joystick — left side of control panel
    stick_x, stick_y = cab_x0 + 10, cp_y0 + 6
    # Base
    circle(c, stick_x, stick_y + 2, 4, BLACK)
    circle(c, stick_x, stick_y + 2, 3, STICK)
    # Stick shaft
    rect(c, stick_x - 1, stick_y - 3, stick_x + 1, stick_y + 2, STICK)
    px(c, stick_x, stick_y - 3, STICK_HI)
    # Ball top
    circle(c, stick_x, stick_y - 4, 3, BLACK)
    circle(c, stick_x, stick_y - 4, 2, STICK)
    px(c, stick_x - 1, stick_y - 5, STICK_HI)

    # Buttons — right side of control panel, red/blue/white row
    btn_y = cp_y0 + 6
    for bx, color in [(cab_x0 + 26, BTN_RED), (cab_x0 + 33, BTN_BLUE), (cab_x0 + 40, BTN_WHITE)]:
        circle(c, bx, btn_y, 3, BLACK)
        circle(c, bx, btn_y, 2, color)
        px(c, bx - 1, btn_y - 1, (min(255, color[0]+50), min(255, color[1]+50), min(255, color[2]+50), 255))

    # Cabinet outline
    rect_outline(c, cab_x0, cab_y0, cab_x1, cab_y1, BLACK)

    # Coin slot — center lower panel
    rect(c, 28, cab_y1 - 8, 36, cab_y1 - 7, BLACK)

    save_icon(c, "arcade")
    print("Arcade done")


# ─────────────────────────────────────────────────────────────────────────────
# PSX — Mid-90s grey console, PlayStation logo color hint, dual analog ports
# Distinctive: flat grey slab, PS logo colors, CD lid, port pattern
# ─────────────────────────────────────────────────────────────────────────────
def draw_psx():
    S = 64
    c = new_canvas(S)

    BLACK      = (10, 10, 12, 255)
    BODY_DARK  = (88, 85, 90, 255)
    BODY_MID   = (128, 125, 132, 255)
    BODY_LT    = (168, 165, 172, 255)
    BODY_HI    = (205, 203, 210, 255)
    BODY_SPEC  = (228, 226, 232, 255)
    PS_RED     = (185, 20, 20, 255)
    PS_BLUE    = (20, 40, 170, 255)
    PS_GREEN   = (20, 150, 50, 255)
    PS_PINK    = (180, 50, 140, 255)
    DARK_PORT  = (55, 52, 58, 255)
    CD_LID     = (148, 145, 152, 255)

    # Controller — DualShock shape, wide with two pronounced grips
    # Main body
    bx0, by0, bx1, by1 = 2, 18, 61, 48

    dither_gradient_rect(c, bx0, by0, bx1, by1, BODY_LT, BODY_DARK, steps=5)

    # Top highlight
    hline(c, by0, bx0 + 2, bx1 - 2, BODY_SPEC)
    hline(c, by0 + 1, bx0 + 2, bx1 - 2, BODY_HI)
    hline(c, by0 + 2, bx0 + 2, bx1 - 2, BODY_LT)
    dither_rect(c, bx0 + 2, by0 + 3, bx1 - 2, by0 + 4, BODY_MID, BODY_LT, "checker")

    # Handle grips — bottom left and right (DualShock grips)
    # Left grip
    rect(c, bx0, by1 - 12, bx0 + 14, by1, BODY_MID)
    dither_gradient_rect(c, bx0, by1 - 12, bx0 + 14, by1, BODY_LT, BODY_DARK, steps=3)
    rect_outline(c, bx0, by1 - 12, bx0 + 14, by1, BLACK)
    # Right grip
    rect(c, bx1 - 14, by1 - 12, bx1, by1, BODY_MID)
    dither_gradient_rect(c, bx1 - 14, by1 - 12, bx1, by1, BODY_LT, BODY_DARK, steps=3)
    rect_outline(c, bx1 - 14, by1 - 12, bx1, by1, BLACK)

    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    # D-pad — left area
    dp_cx, dp_cy = 14, 33
    rect(c, dp_cx - 5, dp_cy - 2, dp_cx + 5, dp_cy + 2, BLACK)
    rect(c, dp_cx - 2, dp_cy - 5, dp_cx + 2, dp_cy + 5, BLACK)
    rect(c, dp_cx - 4, dp_cy - 1, dp_cx + 4, dp_cy + 1, DARK_PORT)
    rect(c, dp_cx - 1, dp_cy - 4, dp_cx + 1, dp_cy + 4, DARK_PORT)
    hline(c, dp_cy - 4, dp_cx - 1, dp_cx + 1, BODY_HI)

    # Left analog stick (below dpad on DualShock)
    circle(c, 20, 43, 4, BLACK)
    circle(c, 20, 43, 3, DARK_PORT)
    circle(c, 20, 43, 2, BODY_MID)
    px(c, 19, 42, BODY_HI)

    # Right analog stick (center-right)
    circle(c, 42, 43, 4, BLACK)
    circle(c, 42, 43, 3, DARK_PORT)
    circle(c, 42, 43, 2, BODY_MID)
    px(c, 41, 42, BODY_HI)

    # PlayStation face buttons — Triangle, Circle, X, Square with PSX colors
    btn_cx, btn_cy = 50, 30
    # Triangle (top) - green
    for dy in range(-4, 1):
        w = max(1, abs(dy))
        hline(c, btn_cy + dy, btn_cx - w, btn_cx + w, PS_GREEN if dy > -4 else BLACK)
    px(c, btn_cx, btn_cy - 4, BLACK)
    # Circle (right) - red
    circle(c, btn_cx + 5, btn_cy + 1, 3, BLACK)
    circle(c, btn_cx + 5, btn_cy + 1, 2, PS_RED)
    px(c, btn_cx + 4, btn_cy, (230, 70, 70, 255))
    # X (bottom) - blue
    # Draw X shape
    for d in range(-2, 3):
        px(c, btn_cx + d, btn_cy + 5 + d, PS_BLUE if abs(d) < 2 else BLACK)
        px(c, btn_cx + d, btn_cy + 5 - d, PS_BLUE if abs(d) < 2 else BLACK)
    px(c, btn_cx, btn_cy + 5, PS_BLUE)
    # Square (left) - pink
    rect(c, btn_cx - 8, btn_cy - 1, btn_cx - 3, btn_cy + 4, BLACK)
    rect(c, btn_cx - 7, btn_cy, btn_cx - 4, btn_cy + 3, PS_PINK)
    px(c, btn_cx - 7, btn_cy, (210, 90, 170, 255))

    # Start / Select center buttons
    for bx in [29, 35]:
        rect(c, bx - 2, 28, bx + 2, 30, BLACK)
        rect(c, bx - 1, 28, bx + 1, 30, DARK_PORT)

    # L1/R1 shoulder buttons suggestion
    rect(c, bx0, by0 - 3, bx0 + 13, by0, BODY_MID)
    rect_outline(c, bx0, by0 - 3, bx0 + 13, by0, BLACK)
    hline(c, by0 - 3, bx0 + 1, bx0 + 12, BODY_HI)
    rect(c, bx1 - 13, by0 - 3, bx1, by0, BODY_MID)
    rect_outline(c, bx1 - 13, by0 - 3, bx1, by0, BLACK)
    hline(c, by0 - 3, bx1 - 12, bx1 - 1, BODY_HI)

    save_icon(c, "psx")
    print("PSX done")


# ─────────────────────────────────────────────────────────────────────────────
# PSP — Early 2000s sleek black portable, widescreen, analog nub
# Distinctive: wide landscape, big widescreen display, Sony design language
# ─────────────────────────────────────────────────────────────────────────────
def draw_psp():
    S = 64
    c = new_canvas(S)

    BLACK      = (8, 8, 10, 255)
    BODY_DARK  = (20, 20, 22, 255)
    BODY_MID   = (38, 38, 42, 255)
    BODY_LT    = (58, 58, 64, 255)
    BODY_HI    = (88, 88, 96, 255)
    BODY_SPEC  = (128, 128, 138, 255)
    SCR_DARK   = (15, 15, 25, 255)
    SCR_BLUE   = (30, 60, 140, 255)
    SCR_GLOW   = (60, 120, 220, 255)
    SCR_HI     = (140, 190, 255, 255)
    PS_RED     = (185, 20, 20, 255)
    PS_BLUE    = (20, 40, 170, 255)
    PS_GREEN   = (20, 150, 50, 255)
    PS_PINK    = (180, 50, 140, 255)
    HOME_BTN   = (160, 155, 165, 255)
    NEON_TEAL  = (0, 200, 200, 255)

    # PSP body — wide landscape, thin, glossy black
    bx0, by0, bx1, by1 = 1, 10, 62, 54

    dither_gradient_rect(c, bx0, by0, bx1, by1, BODY_LT, BODY_DARK, steps=5)

    # Top specular — very shiny piano black plastic
    hline(c, by0, bx0 + 3, bx1 - 3, BODY_SPEC)
    hline(c, by0 + 1, bx0 + 2, bx1 - 2, BODY_HI)
    hline(c, by0 + 2, bx0 + 2, bx1 - 2, BODY_LT)
    dither_rect(c, bx0 + 2, by0 + 3, bx1 - 2, by0 + 5, BODY_MID, BODY_LT, "checker")

    # Rounded corners — PSP had slightly rounded body
    for corner_px in [(bx0, by0), (bx0, by1), (bx1, by0), (bx1, by1)]:
        px(c, corner_px[0], corner_px[1], (0,0,0,0))

    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    # Widescreen display — big, centered, landscape
    sc_x0, sc_y0, sc_x1, sc_y1 = 12, 14, 52, 42
    rect(c, sc_x0 - 1, sc_y0 - 1, sc_x1 + 1, sc_y1 + 1, BLACK)
    rect(c, sc_x0, sc_y0, sc_x1, sc_y1, SCR_DARK)
    dither_gradient_rect(c, sc_x0, sc_y0, sc_x1, sc_y1, SCR_GLOW, SCR_DARK, steps=5)
    # Widescreen glow effect — blueish
    dither_rect(c, sc_x0, sc_y0, sc_x1, sc_y0 + 3, SCR_GLOW, SCR_BLUE, "checker")
    # Screen highlight — top-left
    for hy in range(sc_y0, sc_y0 + 7):
        for hx in range(sc_x0, sc_x0 + 12):
            if hx - sc_x0 + hy - sc_y0 < 10:
                blend = (10 - (hx - sc_x0 + hy - sc_y0)) / 10.0 * 0.5
                existing = c[hy, hx].copy()
                c[hy, hx] = (
                    min(255, int(existing[0] + 100 * blend)),
                    min(255, int(existing[1] + 150 * blend)),
                    min(255, int(existing[2] + 255 * blend)),
                    255
                )
    rect_outline(c, sc_x0, sc_y0, sc_x1, sc_y1, BLACK)

    # PSP logo glow in screen (home screen suggestion)
    rect(c, 28, 24, 36, 32, (0, 0, 0, 80))

    # D-pad — left side, below and left of screen
    dp_cx, dp_cy = 7, 35
    rect(c, dp_cx - 3, dp_cy - 1, dp_cx + 3, dp_cy + 1, BLACK)
    rect(c, dp_cx - 1, dp_cy - 3, dp_cx + 1, dp_cy + 3, BLACK)
    rect(c, dp_cx - 2, dp_cy - 1, dp_cx + 2, dp_cy + 1, BODY_MID)
    rect(c, dp_cx - 1, dp_cy - 2, dp_cx + 1, dp_cy + 2, BODY_MID)
    px(c, dp_cx, dp_cy - 2, BODY_HI)

    # Analog nub — left side (PSP's distinguishing nub, not a stick)
    circle(c, 7, 26, 3, BLACK)
    circle(c, 7, 26, 2, BODY_MID)
    px(c, 6, 25, BODY_HI)
    # Nub texture (rubberized, suggest with dither)
    dither_rect(c, 5, 24, 9, 28, BODY_DARK, BODY_MID, "checker")
    circle(c, 7, 26, 3, BLACK)  # Redraw outline
    for ry in range(24, 29):
        for rx in range(5, 10):
            dist = ((rx-7)**2 + (ry-26)**2)**0.5
            if 1.5 < dist <= 2.5:
                existing = c[ry, rx].copy()
                if existing[3] > 0:
                    dith = (rx + ry) % 2 == 0
                    c[ry, rx] = BODY_MID if dith else BODY_DARK

    # PSX face buttons — right side
    btn_cx, btn_cy = 57, 28
    # Triangle top
    px(c, btn_cx, btn_cy - 3, PS_GREEN)
    hline(c, btn_cy - 2, btn_cx - 1, btn_cx + 1, PS_GREEN)
    # Circle right
    circle(c, btn_cx + 3, btn_cy, 2, PS_RED)
    # X bottom
    px(c, btn_cx - 1, btn_cy + 2, PS_BLUE)
    px(c, btn_cx + 1, btn_cy + 2, PS_BLUE)
    px(c, btn_cx, btn_cy + 3, PS_BLUE)
    # Square left
    rect(c, btn_cx - 4, btn_cy - 1, btn_cx - 2, btn_cy + 1, PS_PINK)

    # Home button — small circle below screen center
    circle(c, 32, 47, 3, BLACK)
    circle(c, 32, 47, 2, HOME_BTN)
    px(c, 31, 46, BODY_SPEC)

    # Select / Start
    rect(c, 20, 47, 24, 49, BLACK)
    rect(c, 21, 47, 23, 49, BODY_MID)
    rect(c, 39, 47, 43, 49, BLACK)
    rect(c, 40, 47, 42, 49, BODY_MID)

    # Volume / trigger buttons on top edge
    hline(c, by0, bx0 + 5, bx0 + 15, BODY_HI)
    hline(c, by0, bx1 - 15, bx1 - 5, BODY_HI)

    # Memory Stick slot — right side
    rect(c, bx1 - 3, by0 + 10, bx1 - 1, by0 + 18, BLACK)
    hline(c, by0 + 11, bx1 - 2, bx1 - 1, BODY_DARK)

    # UMD laser light (on bottom) — teal LED
    px(c, 32, by1 - 2, NEON_TEAL)
    px(c, 32, by1 - 3, (0, 150, 150, 255))

    save_icon(c, "psp")
    print("PSP done")


# ─────────────────────────────────────────────────────────────────────────────
# COMPARISON SHEET — v1 vs v2 side by side
# ─────────────────────────────────────────────────────────────────────────────
def make_comparison_sheet():
    import os
    systems = ["nes", "snes", "n64", "gb", "gbc", "gba", "genesis", "mastersystem", "arcade", "psx", "psp"]

    icon_size = 64
    padding = 8
    label_h = 14
    row_h = icon_size + label_h + padding * 2
    col_w = icon_size * 2 + padding * 3 + 20  # v1 + gap + v2 + label area

    sheet_w = col_w * 2 + padding * 2
    sheet_h = row_h * 6 + padding * 2  # 6 rows of 2 columns

    sheet = Image.new("RGBA", (sheet_w, sheet_h), (30, 28, 35, 255))

    try:
        from PIL import ImageDraw, ImageFont
        draw = ImageDraw.Draw(sheet)
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 9)
            font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 8)
        except:
            font = ImageFont.load_default()
            font_sm = font
    except Exception as e:
        print(f"Font error: {e}")
        return

    # Column layout: 2 columns of icons, each col has v1 left, v2 right
    for i, slug in enumerate(systems):
        col = i % 2
        row = i // 2

        base_x = padding + col * col_w
        base_y = padding + row * row_h

        # System label
        draw.text((base_x, base_y), slug.upper(), fill=(180, 170, 200, 255), font=font)

        img_y = base_y + label_h

        # V1 label
        draw.text((base_x, img_y - 1), "v1", fill=(120, 110, 140, 255), font=font_sm)

        # Load v1 icon
        v1_path = os.path.join(OUT_DIR, f"{slug}-64.png")
        # v1 is what we're overwriting — we need to load BEFORE overwriting
        # At this point they've already been overwritten. We saved v1 copies.
        v1_backup = f"/tmp/cartdex_v1_backup/{slug}-64.png"
        if os.path.exists(v1_backup):
            v1 = Image.open(v1_backup).resize((icon_size, icon_size), Image.NEAREST)
        else:
            v1 = Image.new("RGBA", (icon_size, icon_size), (60, 55, 80, 255))
            draw.text((base_x + 2, img_y + 2), "v1 N/A", fill=(255,0,0,255), font=font_sm)

        # Paste v1
        v1_x = base_x + 15
        sheet.paste(v1, (v1_x, img_y), v1)

        # Arrow / separator
        mid_x = v1_x + icon_size + 6
        draw.text((mid_x, img_y + icon_size // 2 - 4), ">", fill=(200, 180, 100, 255), font=font)

        # Load v2 icon
        v2_path = os.path.join(OUT_DIR, f"{slug}-64.png")
        if os.path.exists(v2_path):
            v2 = Image.open(v2_path).resize((icon_size, icon_size), Image.NEAREST)
        else:
            v2 = Image.new("RGBA", (icon_size, icon_size), (80, 60, 100, 255))

        v2_x = mid_x + 14
        sheet.paste(v2, (v2_x, img_y), v2)

        # V2 label
        draw.text((v2_x, img_y - 1), "v2", fill=(120, 200, 120, 255), font=font_sm)

    sheet.save("/home/claude/projects/DOCS/Projects/cartdex/icon-v1-v2-comparison.png")
    print("Comparison sheet saved.")


# ─────────────────────────────────────────────────────────────────────────────
# BACKUP V1 ICONS BEFORE OVERWRITING
# ─────────────────────────────────────────────────────────────────────────────
def backup_v1():
    import shutil
    backup_dir = "/tmp/cartdex_v1_backup"
    os.makedirs(backup_dir, exist_ok=True)
    for f in os.listdir(OUT_DIR):
        if f.endswith(".png"):
            shutil.copy2(os.path.join(OUT_DIR, f), os.path.join(backup_dir, f))
    print(f"v1 icons backed up to {backup_dir}")


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)

    print("=== Cartdex Icon v2 Generation ===")
    print("Backing up v1...")
    backup_v1()

    print("\nDrawing icons...")
    draw_nes()
    draw_snes()
    draw_n64()
    draw_gb()
    draw_gbc()
    draw_gba()
    draw_genesis()
    draw_mastersystem()
    draw_arcade()
    draw_psx()
    draw_psp()

    print("\nGenerating comparison sheet...")
    make_comparison_sheet()

    print("\nDone. All icons written to", OUT_DIR)
