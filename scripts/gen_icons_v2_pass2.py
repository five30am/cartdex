#!/usr/bin/env python3
"""
Cartdex Icon v2 — Pass 2 revisions
Fixes N64 trident, SNES buttons, PSX grip silhouette.
"""

from PIL import Image
import numpy as np
import os

OUT_DIR = "/home/claude/projects/cartdex/public/icons/systems"

def new_canvas(size=64):
    return np.zeros((size, size, 4), dtype=np.uint8)

def px(canvas, x, y, color):
    if 0 <= x < canvas.shape[1] and 0 <= y < canvas.shape[0]:
        canvas[y, x] = color

def hline(canvas, y, x0, x1, color):
    for x in range(x0, x1 + 1):
        px(canvas, x, y, color)

def vline(canvas, x, y0, y1, color):
    for y in range(y0, y1 + 1):
        px(canvas, x, y, color)

def rect(canvas, x0, y0, x1, y1, color):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(canvas, x, y, color)

def rect_outline(canvas, x0, y0, x1, y1, color, thickness=1):
    for t in range(thickness):
        hline(canvas, y0 + t, x0 + t, x1 - t, color)
        hline(canvas, y1 - t, x0 + t, x1 - t, color)
        vline(canvas, x0 + t, y0 + t, y1 - t, color)
        vline(canvas, x1 - t, y0 + t, y1 - t, color)

def circle_fill(canvas, cx, cy, r, color):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                px(canvas, x, y, color)

def dither_rect(canvas, x0, y0, x1, y1, color_a, color_b, pattern="checker"):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < canvas.shape[1] and 0 <= y < canvas.shape[0]:
                if pattern == "checker":
                    use_b = (x + y) % 2 == 1
                elif pattern == "quarter_a":
                    use_b = (x % 2 == 1) and (y % 2 == 1)
                elif pattern == "quarter_b":
                    use_b = not ((x % 2 == 0) and (y % 2 == 0))
                else:
                    use_b = False
                canvas[y, x] = color_b if use_b else color_a

def dither_gradient_rect(canvas, x0, y0, x1, y1, color_top, color_bot, steps=4):
    height = y1 - y0 + 1
    if height <= 0:
        return
    for s in range(steps):
        by0 = y0 + int(s * height / steps)
        by1 = y0 + int((s + 1) * height / steps) - 1
        t0 = s / steps
        t1 = (s + 0.5) / steps
        r = int(color_top[0] * (1 - t0) + color_bot[0] * t0)
        g = int(color_top[1] * (1 - t0) + color_bot[1] * t0)
        b = int(color_top[2] * (1 - t0) + color_bot[2] * t0)
        c_main = (r, g, b, 255)
        r2 = int(color_top[0] * (1 - t1) + color_bot[0] * t1)
        g2 = int(color_top[1] * (1 - t1) + color_bot[1] * t1)
        b2 = int(color_top[2] * (1 - t1) + color_bot[2] * t1)
        c_next = (r2, g2, b2, 255)
        for y in range(by0, by1):
            hline(canvas, y, x0, x1, c_main)
        if by1 <= y1:
            for x in range(x0, x1 + 1):
                canvas[by1, x] = c_next if (x % 2 == 0) else c_main

def save_icon(canvas, slug, sizes=(32, 64)):
    img = Image.fromarray(canvas.astype(np.uint8), 'RGBA')
    for size in sizes:
        out = img.resize((size, size), Image.NEAREST)
        path = os.path.join(OUT_DIR, f"{slug}-{size}.png")
        out.save(path, optimize=True)
        print(f"  Saved {path}")


# ─────────────────────────────────────────────────────────────────────────────
# N64 — Revised: Focus on the cartridge-loaded top + trident outline + C-buttons
# The recognition cue is the THREE-HANDLE shape — must read at 32px
# ─────────────────────────────────────────────────────────────────────────────
def draw_n64_v2():
    S = 64
    c = new_canvas(S)

    BLACK      = (10, 10, 12, 255)
    BODY_DARK  = (62, 58, 68, 255)
    BODY_MID   = (98, 92, 108, 255)
    BODY_LT    = (140, 132, 152, 255)
    BODY_HI    = (180, 172, 192, 255)
    BODY_SPEC  = (210, 204, 220, 255)
    YELLOW_C   = (215, 185, 15, 255)
    GREEN_A    = (30, 160, 60, 255)
    GREEN_HI   = (80, 210, 110, 255)
    RED_B      = (200, 30, 30, 255)
    GREY_DPAD  = (72, 68, 80, 255)

    # N64 trident approach:
    # Draw the TOP of the controller head-on — the wide body + 3 grip tabs
    # At 64px: body block 14-50 wide, center spine, left and right grips dropping down

    # === Main center body block ===
    cx0, cy0, cx1, cy1 = 16, 8, 48, 40
    dither_gradient_rect(c, cx0, cy0, cx1, cy1, BODY_LT, BODY_DARK, steps=5)
    hline(c, cy0, cx0 + 1, cx1 - 1, BODY_SPEC)
    hline(c, cy0 + 1, cx0 + 1, cx1 - 1, BODY_HI)

    # === Left grip ===
    lx0, ly0, lx1, ly1 = 4, 20, 20, 56
    dither_gradient_rect(c, lx0, ly0, lx1, ly1, BODY_LT, BODY_DARK, steps=4)
    hline(c, ly0, lx0 + 1, lx1 - 1, BODY_HI)

    # === Center grip (the MIDDLE prong — N64's defining feature) ===
    mx0, my0, mx1, my1 = 24, 38, 40, 58
    dither_gradient_rect(c, mx0, my0, mx1, my1, BODY_MID, BODY_DARK, steps=3)

    # === Right grip ===
    rx0, ry0, rx1, ry1 = 44, 20, 60, 56
    dither_gradient_rect(c, rx0, ry0, rx1, ry1, BODY_LT, BODY_DARK, steps=4)
    hline(c, ry0, rx0 + 1, rx1 - 1, BODY_HI)

    # Outlines — draw last over fills
    rect_outline(c, cx0, cy0, cx1, cy1, BLACK)
    rect_outline(c, lx0, ly0, lx1, ly1, BLACK)
    rect_outline(c, mx0, my0, mx1, my1, BLACK)
    rect_outline(c, rx0, ry0, rx1, ry1, BLACK)

    # === Cartridge slot on top ===
    rect(c, 26, cy0, 38, cy0 + 6, BLACK)
    hline(c, cy0 + 1, 27, 37, BODY_DARK)
    hline(c, cy0 + 3, 27, 37, BODY_DARK)
    hline(c, cy0 + 5, 27, 37, BODY_DARK)

    # === Analog stick — LEFT grip, upper area (defining N64 feature) ===
    # The analog stick is the #1 recognition cue for N64
    as_cx, as_cy = 12, 30
    # Outer base ring
    circle_fill(c, as_cx, as_cy, 5, BLACK)
    circle_fill(c, as_cx, as_cy, 4, BODY_DARK)
    # Stick shaft depression
    circle_fill(c, as_cx, as_cy, 3, BODY_MID)
    circle_fill(c, as_cx, as_cy, 2, BODY_LT)
    # Octogate suggest (8 points around)
    for dx, dy in [(0, -3), (2, -2), (3, 0), (2, 2), (0, 3), (-2, 2), (-3, 0), (-2, -2)]:
        px(c, as_cx + dx, as_cy + dy, BODY_DARK)
    # Highlight
    px(c, as_cx - 1, as_cy - 2, BODY_HI)
    px(c, as_cx, as_cy - 2, BODY_SPEC)

    # === D-pad — center body, left side ===
    dp_cx, dp_cy = 24, 26
    rect(c, dp_cx - 4, dp_cy - 1, dp_cx + 4, dp_cy + 1, BLACK)
    rect(c, dp_cx - 1, dp_cy - 4, dp_cx + 1, dp_cy + 4, BLACK)
    rect(c, dp_cx - 3, dp_cy - 1, dp_cx + 3, dp_cy + 1, GREY_DPAD)
    rect(c, dp_cx - 1, dp_cy - 3, dp_cx + 1, dp_cy + 3, GREY_DPAD)
    px(c, dp_cx - 3, dp_cy, BODY_HI)
    px(c, dp_cx, dp_cy - 3, BODY_HI)

    # === C-buttons — YELLOW, right grip upper area ===
    # Distinctive yellow diamond arrangement
    cy_cx, cy_cy = 52, 27
    # Top C-button
    circle_fill(c, cy_cx, cy_cy - 5, 3, BLACK)
    circle_fill(c, cy_cx, cy_cy - 5, 2, YELLOW_C)
    px(c, cy_cx - 1, cy_cy - 6, (255, 220, 80, 255))
    # Right
    circle_fill(c, cy_cx + 5, cy_cy, 3, BLACK)
    circle_fill(c, cy_cx + 5, cy_cy, 2, YELLOW_C)
    # Bottom
    circle_fill(c, cy_cx, cy_cy + 5, 3, BLACK)
    circle_fill(c, cy_cx, cy_cy + 5, 2, YELLOW_C)
    # Left
    circle_fill(c, cy_cx - 5, cy_cy, 3, BLACK)
    circle_fill(c, cy_cx - 5, cy_cy, 2, YELLOW_C)

    # === A button — right grip, large green circle ===
    a_cx, a_cy = 52, 38
    circle_fill(c, a_cx, a_cy, 5, BLACK)
    circle_fill(c, a_cx, a_cy, 4, GREEN_A)
    px(c, a_cx - 2, a_cy - 2, GREEN_HI)
    px(c, a_cx - 1, a_cy - 3, GREEN_HI)

    # === B button — smaller red circle ===
    circle_fill(c, 46, 44, 3, BLACK)
    circle_fill(c, 46, 44, 2, RED_B)
    px(c, 45, 43, (240, 80, 80, 255))

    # === Start button — center body, prominent ===
    circle_fill(c, 32, 26, 4, BLACK)
    circle_fill(c, 32, 26, 3, BODY_MID)
    px(c, 31, 25, BODY_HI)

    # === Z trigger — bottom of center prong ===
    rect(c, mx0 + 2, my1 - 6, mx1 - 2, my1 - 3, BLACK)
    hline(c, my1 - 5, mx0 + 3, mx1 - 3, BODY_DARK)
    hline(c, my1 - 4, mx0 + 3, mx1 - 3, BODY_MID)

    save_icon(c, "n64")
    print("N64 v2 done")


# ─────────────────────────────────────────────────────────────────────────────
# SNES Revised — ABXY buttons are the HERO. Make them big and vivid.
# Lavender body, shoulder bumps, ABXY diamond clearly legible
# ─────────────────────────────────────────────────────────────────────────────
def draw_snes_v2():
    S = 64
    c = new_canvas(S)

    BLACK       = (15, 12, 20, 255)
    BODY_DARK   = (72, 65, 92, 255)
    BODY_MID    = (108, 98, 138, 255)
    BODY_LT     = (152, 138, 182, 255)
    BODY_HI     = (188, 175, 215, 255)
    BODY_SPEC   = (215, 205, 235, 255)
    DARK_PLATE  = (50, 44, 68, 255)
    # SNES USA face buttons — these must be VIVID
    BTN_B       = (228, 190, 8, 255)     # Yellow
    BTN_A       = (195, 28, 48, 255)     # Red
    BTN_X       = (48, 88, 195, 255)     # Blue
    BTN_Y       = (28, 158, 75, 255)     # Green
    BTN_B_HI    = (255, 225, 80, 255)
    BTN_A_HI    = (235, 80, 80, 255)
    BTN_X_HI    = (100, 145, 230, 255)
    BTN_Y_HI    = (75, 200, 115, 255)
    GREY_START  = (65, 58, 82, 255)
    GREY_DPAD   = (58, 52, 74, 255)
    GREY_DPAD_F = (88, 80, 108, 255)

    # Wide landscape controller — SNES
    bx0, by0, bx1, by1 = 3, 14, 60, 52

    dither_gradient_rect(c, bx0, by0, bx1, by1, BODY_LT, BODY_DARK, steps=6)
    hline(c, by0, bx0 + 4, bx1 - 4, BODY_SPEC)
    hline(c, by0 + 1, bx0 + 3, bx1 - 3, BODY_HI)
    hline(c, by0 + 2, bx0 + 3, bx1 - 3, BODY_LT)
    dither_rect(c, bx0 + 3, by0 + 3, bx1 - 3, by0 + 4, BODY_MID, BODY_LT, "checker")

    # Rounded corners — 3px clip
    for dx, dy in [(0,0),(1,0),(0,1),(2,0),(0,2),(1,1)]:
        px(c, bx0 + dx, by0 + dy, (0,0,0,0)) if dx+dy < 3 else None
    px(c, bx0, by0, (0,0,0,0))
    px(c, bx0+1, by0, (0,0,0,0))
    px(c, bx0, by0+1, (0,0,0,0))
    px(c, bx1, by0, (0,0,0,0))
    px(c, bx1-1, by0, (0,0,0,0))
    px(c, bx1, by0+1, (0,0,0,0))
    px(c, bx0, by1, (0,0,0,0))
    px(c, bx0+1, by1, (0,0,0,0))
    px(c, bx0, by1-1, (0,0,0,0))
    px(c, bx1, by1, (0,0,0,0))
    px(c, bx1-1, by1, (0,0,0,0))
    px(c, bx1, by1-1, (0,0,0,0))

    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    # Shoulder buttons — L and R tabs
    rect(c, bx0, by0 - 5, bx0 + 14, by0, BODY_MID)
    rect_outline(c, bx0, by0 - 5, bx0 + 14, by0, BLACK)
    hline(c, by0 - 5, bx0 + 1, bx0 + 13, BODY_HI)
    dither_rect(c, bx0 + 1, by0 - 4, bx0 + 13, by0 - 2, BODY_MID, BODY_LT, "checker")

    rect(c, bx1 - 14, by0 - 5, bx1, by0, BODY_MID)
    rect_outline(c, bx1 - 14, by0 - 5, bx1, by0, BLACK)
    hline(c, by0 - 5, bx1 - 13, bx1 - 1, BODY_HI)
    dither_rect(c, bx1 - 13, by0 - 4, bx1 - 1, by0 - 2, BODY_MID, BODY_LT, "checker")

    # Center dark face plate (recessed)
    cp_x0, cp_y0, cp_x1, cp_y1 = 19, 22, 44, 42
    rect(c, cp_x0, cp_y0, cp_x1, cp_y1, DARK_PLATE)
    rect_outline(c, cp_x0, cp_y0, cp_x1, cp_y1, BLACK)

    # D-pad — left, clearly visible
    dp_cx, dp_cy = 14, 33
    rect(c, dp_cx - 6, dp_cy - 2, dp_cx + 6, dp_cy + 2, BLACK)
    rect(c, dp_cx - 2, dp_cy - 6, dp_cx + 2, dp_cy + 6, BLACK)
    rect(c, dp_cx - 5, dp_cy - 1, dp_cx + 5, dp_cy + 1, GREY_DPAD_F)
    rect(c, dp_cx - 1, dp_cy - 5, dp_cx + 1, dp_cy + 5, GREY_DPAD_F)
    rect(c, dp_cx - 1, dp_cy - 1, dp_cx + 1, dp_cy + 1, BODY_LT)
    # Dpad arm bevels
    hline(c, dp_cy - 5, dp_cx - 1, dp_cx + 1, BODY_HI)
    px(c, dp_cx - 5, dp_cy, BODY_HI)

    # Select / Start — two pill buttons in center
    for bx in [28, 35]:
        rect(c, bx - 3, 34, bx + 3, 36, BLACK)
        rect(c, bx - 2, 34, bx + 2, 36, GREY_START)
        hline(c, 34, bx - 1, bx + 1, BODY_MID)

    # ====================================================================
    # ABXY face buttons — THE HERO OF THIS ICON
    # Large diamond arrangement on the RIGHT side
    # These must be vivid and immediately recognizable
    # ====================================================================
    btn_cx, btn_cy = 49, 30

    # B — BOTTOM (yellow) — most prominent position
    circle_fill(c, btn_cx, btn_cy + 6, 5, BLACK)
    circle_fill(c, btn_cx, btn_cy + 6, 4, BTN_B)
    px(c, btn_cx - 1, btn_cy + 4, BTN_B_HI)
    px(c, btn_cx, btn_cy + 4, BTN_B_HI)
    px(c, btn_cx - 2, btn_cy + 5, BTN_B_HI)

    # A — RIGHT (red)
    circle_fill(c, btn_cx + 6, btn_cy, 5, BLACK)
    circle_fill(c, btn_cx + 6, btn_cy, 4, BTN_A)
    px(c, btn_cx + 4, btn_cy - 2, BTN_A_HI)
    px(c, btn_cx + 5, btn_cy - 2, BTN_A_HI)

    # X — TOP (blue)
    circle_fill(c, btn_cx, btn_cy - 6, 5, BLACK)
    circle_fill(c, btn_cx, btn_cy - 6, 4, BTN_X)
    px(c, btn_cx - 2, btn_cy - 8, BTN_X_HI)
    px(c, btn_cx - 1, btn_cy - 8, BTN_X_HI)

    # Y — LEFT (green)
    circle_fill(c, btn_cx - 6, btn_cy, 5, BLACK)
    circle_fill(c, btn_cx - 6, btn_cy, 4, BTN_Y)
    px(c, btn_cx - 8, btn_cy - 2, BTN_Y_HI)
    px(c, btn_cx - 7, btn_cy - 2, BTN_Y_HI)

    # Bottom grip texture — dither to suggest hand grip curvature
    dither_rect(c, bx0 + 2, by1 - 9, bx0 + 12, by1 - 2, BODY_DARK, BODY_MID, "checker")
    dither_rect(c, bx1 - 12, by1 - 9, bx1 - 2, by1 - 2, BODY_DARK, BODY_MID, "checker")

    save_icon(c, "snes")
    print("SNES v2 done")


# ─────────────────────────────────────────────────────────────────────────────
# PSX Revised — DualShock silhouette with clear double-grip droop
# The twin grips are the recognition cue. PSX face buttons in color.
# ─────────────────────────────────────────────────────────────────────────────
def draw_psx_v2():
    S = 64
    c = new_canvas(S)

    BLACK      = (10, 10, 12, 255)
    BODY_DARK  = (82, 80, 86, 255)
    BODY_MID   = (122, 120, 128, 255)
    BODY_LT    = (162, 160, 168, 255)
    BODY_HI    = (200, 198, 206, 255)
    BODY_SPEC  = (228, 226, 232, 255)
    DARK_FACE  = (58, 56, 62, 255)
    # PlayStation face button colors
    PS_TRI     = (30, 175, 115, 255)   # Green-teal triangle
    PS_CIR     = (195, 35, 55, 255)    # Red circle
    PS_CRO     = (45, 80, 200, 255)    # Blue X
    PS_SQR     = (195, 55, 165, 255)   # Pink square
    PS_TRI_HI  = (80, 215, 155, 255)
    PS_CIR_HI  = (235, 85, 90, 255)
    GREY_STICK = (65, 63, 68, 255)
    GREY_DPAD  = (72, 70, 78, 255)

    # DualShock top body
    bx0, by0, bx1, by1 = 2, 12, 61, 38
    dither_gradient_rect(c, bx0, by0, bx1, by1, BODY_LT, BODY_DARK, steps=5)
    hline(c, by0, bx0 + 2, bx1 - 2, BODY_SPEC)
    hline(c, by0 + 1, bx0 + 2, bx1 - 2, BODY_HI)
    hline(c, by0 + 2, bx0 + 2, bx1 - 2, BODY_LT)
    dither_rect(c, bx0 + 2, by0 + 3, bx1 - 2, by0 + 4, BODY_MID, BODY_LT, "checker")
    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    # === Dual grip handles — the DualShock signature ===
    # Left grip droops down
    lg_x0, lg_y0, lg_x1, lg_y1 = 2, 32, 18, 58
    dither_gradient_rect(c, lg_x0, lg_y0, lg_x1, lg_y1, BODY_LT, BODY_DARK, steps=4)
    rect_outline(c, lg_x0, lg_y0, lg_x1, lg_y1, BLACK)
    # Right grip droops down
    rg_x0, rg_y0, rg_x1, rg_y1 = 46, 32, 62, 58
    dither_gradient_rect(c, rg_x0, rg_y0, rg_x1, rg_y1, BODY_LT, BODY_DARK, steps=4)
    rect_outline(c, rg_x0, rg_y0, rg_x1, rg_y1, BLACK)

    # Inside gap between grips (darker notch)
    rect(c, 19, 38, 45, 52, BODY_DARK)
    dither_rect(c, 20, 39, 44, 51, BODY_DARK, BLACK, "quarter_a")

    # L1/R1 shoulder buttons
    rect(c, bx0, by0 - 5, bx0 + 14, by0, BODY_MID)
    rect_outline(c, bx0, by0 - 5, bx0 + 14, by0, BLACK)
    hline(c, by0 - 5, bx0 + 1, bx0 + 13, BODY_HI)
    rect(c, bx1 - 14, by0 - 5, bx1, by0, BODY_MID)
    rect_outline(c, bx1 - 14, by0 - 5, bx1, by0, BLACK)
    hline(c, by0 - 5, bx1 - 13, bx1 - 1, BODY_HI)

    # D-pad — left area, cross
    dp_cx, dp_cy = 13, 26
    rect(c, dp_cx - 5, dp_cy - 2, dp_cx + 5, dp_cy + 2, BLACK)
    rect(c, dp_cx - 2, dp_cy - 5, dp_cx + 2, dp_cy + 5, BLACK)
    rect(c, dp_cx - 4, dp_cy - 1, dp_cx + 4, dp_cy + 1, GREY_DPAD)
    rect(c, dp_cx - 1, dp_cy - 4, dp_cx + 1, dp_cy + 4, GREY_DPAD)
    hline(c, dp_cy - 4, dp_cx - 1, dp_cx + 1, BODY_HI)

    # Left analog stick (below d-pad in grip area)
    circle_fill(c, 10, 44, 5, BLACK)
    circle_fill(c, 10, 44, 4, GREY_STICK)
    circle_fill(c, 10, 44, 3, BODY_MID)
    # Texture dots on stick cap
    dither_rect(c, 7, 41, 13, 47, GREY_STICK, BODY_MID, "checker")
    circle_fill(c, 10, 44, 5, BLACK)  # Re-outline
    for ry in range(39, 50):
        for rx in range(5, 16):
            dist = ((rx-10)**2 + (ry-44)**2)**0.5
            if 2.5 < dist <= 4.5:
                existing = c[ry, rx].copy()
                if existing[3] > 0:
                    c[ry, rx] = GREY_STICK if (rx+ry)%2==0 else BODY_MID

    # Right analog stick (in right grip area)
    circle_fill(c, 54, 44, 5, BLACK)
    circle_fill(c, 54, 44, 4, GREY_STICK)
    circle_fill(c, 54, 44, 3, BODY_MID)
    for ry in range(39, 50):
        for rx in range(49, 60):
            dist = ((rx-54)**2 + (ry-44)**2)**0.5
            if 2.5 < dist <= 4.5:
                existing = c[ry, rx].copy()
                if existing[3] > 0:
                    c[ry, rx] = GREY_STICK if (rx+ry)%2==0 else BODY_MID

    # ====================================================================
    # PS FACE BUTTONS — must be vivid and recognizable
    # Triangle, Circle, X, Square in PSX color diamond
    # ====================================================================
    btn_cx, btn_cy = 50, 24

    # Triangle (top) — teal/green
    # Filled triangle pointing up
    for row in range(5):
        w = row
        y_pos = btn_cy - 4 + row
        if w == 0:
            px(c, btn_cx, y_pos, PS_TRI)
        else:
            hline(c, y_pos, btn_cx - w, btn_cx + w, PS_TRI)
    px(c, btn_cx - 1, btn_cy - 3, PS_TRI_HI)
    px(c, btn_cx, btn_cy - 4, PS_TRI_HI)

    # Circle (right) — red
    circle_fill(c, btn_cx + 6, btn_cy, 3, BLACK)
    circle_fill(c, btn_cx + 6, btn_cy, 2, PS_CIR)
    px(c, btn_cx + 5, btn_cy - 1, PS_CIR_HI)

    # X (bottom) — blue cross
    x_cx, x_cy = btn_cx, btn_cy + 6
    for d in range(-3, 4):
        px(c, x_cx + d, x_cy + d, PS_CRO)
        px(c, x_cx + d, x_cy - d, PS_CRO)
    # Thicken
    for d in range(-2, 3):
        if abs(d) < 3:
            px(c, x_cx + d + 1, x_cy + d, PS_CRO)
            px(c, x_cx + d + 1, x_cy - d, PS_CRO)

    # Square (left) — pink
    rect(c, btn_cx - 9, btn_cy - 2, btn_cx - 4, btn_cy + 2, BLACK)
    rect(c, btn_cx - 8, btn_cy - 2, btn_cx - 4, btn_cy + 2, PS_SQR)
    rect(c, btn_cx - 8, btn_cy - 1, btn_cx - 5, btn_cy + 1, PS_SQR)
    px(c, btn_cx - 8, btn_cy - 2, (220, 100, 195, 255))

    # Start / Select — center
    for bx in [29, 35]:
        rect(c, bx - 2, 22, bx + 2, 24, BLACK)
        rect(c, bx - 1, 22, bx + 1, 24, DARK_FACE)

    save_icon(c, "psx")
    print("PSX v2 done")


# ─────────────────────────────────────────────────────────────────────────────
# Master System Revised — Red stripe is the era cue, cleaner form
# Very boxy 80s controller with large hexagonal buttons
# ─────────────────────────────────────────────────────────────────────────────
def draw_mastersystem_v2():
    S = 64
    c = new_canvas(S)

    BLACK      = (10, 10, 10, 255)
    BODY_DARK  = (28, 22, 22, 255)
    BODY_MID   = (52, 44, 44, 255)
    BODY_LT    = (80, 72, 72, 255)
    BODY_HI    = (112, 104, 104, 255)
    BODY_SPEC  = (145, 136, 136, 255)
    RED_STRIPE = (200, 30, 20, 255)
    RED_DARK   = (130, 12, 8, 255)
    RED_HI     = (235, 75, 65, 255)
    WHITE_TRIM = (205, 200, 195, 255)
    GREY_BTN   = (88, 82, 82, 255)
    GREY_DPAD  = (70, 65, 65, 255)
    DPAD_F     = (95, 88, 88, 255)

    # Boxy landscape controller — very 80s rectangular
    bx0, by0, bx1, by1 = 3, 16, 60, 50

    dither_gradient_rect(c, bx0, by0, bx1, by1, BODY_LT, BODY_DARK, steps=4)

    # Top specular strip
    hline(c, by0, bx0 + 1, bx1 - 1, BODY_SPEC)
    hline(c, by0 + 1, bx0 + 1, bx1 - 1, BODY_HI)
    hline(c, by0 + 2, bx0 + 1, bx1 - 1, BODY_LT)
    dither_rect(c, bx0 + 1, by0 + 3, bx1 - 1, by0 + 4, BODY_MID, BODY_LT, "checker")

    # ====================================================================
    # RED STRIPE — the SMS's most distinctive visual feature
    # Bold red horizontal band across the middle of the controller
    # ====================================================================
    stripe_y0 = by0 + 8
    stripe_y1 = by0 + 14
    # Dark border above stripe
    hline(c, stripe_y0 - 1, bx0 + 1, bx1 - 1, (50, 10, 8, 255))
    # Main red stripe with gradient
    hline(c, stripe_y0, bx0 + 1, bx1 - 1, RED_HI)
    hline(c, stripe_y0 + 1, bx0 + 1, bx1 - 1, RED_STRIPE)
    hline(c, stripe_y0 + 2, bx0 + 1, bx1 - 1, RED_STRIPE)
    hline(c, stripe_y0 + 3, bx0 + 1, bx1 - 1, RED_DARK)
    hline(c, stripe_y0 + 4, bx0 + 1, bx1 - 1, RED_DARK)
    hline(c, stripe_y0 + 5, bx0 + 1, bx1 - 1, (80, 8, 5, 255))
    # Dark border below stripe
    hline(c, stripe_y1 + 1, bx0 + 1, bx1 - 1, BODY_DARK)

    # D-pad — left side, classic cross
    dp_cx, dp_cy = 15, 38
    rect(c, dp_cx - 6, dp_cy - 2, dp_cx + 6, dp_cy + 2, BLACK)
    rect(c, dp_cx - 2, dp_cy - 6, dp_cx + 2, dp_cy + 6, BLACK)
    rect(c, dp_cx - 5, dp_cy - 1, dp_cx + 5, dp_cy + 1, DPAD_F)
    rect(c, dp_cx - 1, dp_cy - 5, dp_cx + 1, dp_cy + 5, DPAD_F)
    rect(c, dp_cx - 1, dp_cy - 1, dp_cx + 1, dp_cy + 1, BODY_HI)
    # Dpad highlights
    hline(c, dp_cy - 5, dp_cx - 1, dp_cx + 1, BODY_HI)
    px(c, dp_cx - 5, dp_cy, BODY_HI)

    # Pause button — center, small
    rect(c, 29, stripe_y0 + 1, 34, stripe_y0 + 3, BLACK)
    rect(c, 30, stripe_y0 + 1, 33, stripe_y0 + 3, GREY_BTN)

    # ====================================================================
    # 1 and 2 buttons — large hexagonal red buttons (SMS's signature)
    # These were BIG buttons, very tactile, very 80s
    # ====================================================================
    for btn_cx, btn_cy in [(43, 36), (53, 36)]:
        # Hex shape approx — rounded diamond
        circle_fill(c, btn_cx, btn_cy, 6, BLACK)
        circle_fill(c, btn_cx, btn_cy, 5, RED_DARK)
        circle_fill(c, btn_cx, btn_cy, 4, RED_STRIPE)
        # Top-left highlight — specular on convex button
        px(c, btn_cx - 2, btn_cy - 3, RED_HI)
        px(c, btn_cx - 1, btn_cy - 3, RED_HI)
        px(c, btn_cx - 3, btn_cy - 1, RED_HI)
        px(c, btn_cx - 3, btn_cy - 2, RED_HI)
        # Bottom shadow
        px(c, btn_cx + 2, btn_cy + 3, (70, 5, 3, 255))
        px(c, btn_cx + 3, btn_cy + 2, (70, 5, 3, 255))

    # Body outline
    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    # White trim strip at top of controller face
    hline(c, by0, bx0 + 1, bx1 - 1, WHITE_TRIM)
    hline(c, by0 + 1, bx0 + 1, bx1 - 1, BODY_HI)

    save_icon(c, "mastersystem")
    print("Master System v2 done")


# ─────────────────────────────────────────────────────────────────────────────
# GBA Revised — Landscape, strong shoulder buttons, vivid A/B
# ─────────────────────────────────────────────────────────────────────────────
def draw_gba_v2():
    S = 64
    c = new_canvas(S)

    BLACK      = (10, 10, 10, 255)
    BODY_DARK  = (28, 26, 52, 255)
    BODY_MID   = (52, 48, 92, 255)
    BODY_LT    = (82, 76, 135, 255)
    BODY_HI    = (118, 110, 172, 255)
    BODY_SPEC  = (155, 148, 205, 255)
    SCR_DARK   = (22, 20, 38, 255)
    SCR_MID    = (38, 58, 128, 255)
    SCR_GLOW   = (68, 108, 195, 255)
    SCR_HI     = (130, 180, 235, 255)
    BTN_A      = (195, 28, 48, 255)
    BTN_B      = (180, 28, 48, 255)
    BTN_A_HI   = (235, 85, 85, 255)
    GREY_DPAD  = (68, 62, 88, 255)
    DPAD_F     = (92, 85, 118, 255)
    DARK_BEVEL = (18, 16, 36, 255)

    # LANDSCAPE body
    bx0, by0, bx1, by1 = 1, 12, 62, 52
    dither_gradient_rect(c, bx0, by0, bx1, by1, BODY_LT, BODY_DARK, steps=5)
    hline(c, by0, bx0 + 3, bx1 - 3, BODY_SPEC)
    hline(c, by0 + 1, bx0 + 2, bx1 - 2, BODY_HI)
    hline(c, by0 + 2, bx0 + 2, bx1 - 2, BODY_LT)
    dither_rect(c, bx0 + 2, by0 + 3, bx1 - 2, by0 + 5, BODY_MID, BODY_LT, "checker")

    # Corner rounding
    for corner_px_pair in [(bx0, by0), (bx1, by0), (bx0, by1), (bx1, by1)]:
        cx, cy = corner_px_pair
        px(c, cx, cy, (0,0,0,0))
        px(c, cx + (1 if cx == bx0 else -1), cy, (0,0,0,0))
        px(c, cx, cy + (1 if cy == by0 else -1), (0,0,0,0))

    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    # Shoulder buttons — large prominent tabs (GBA had chunky shoulders)
    rect(c, bx0, by0 - 6, bx0 + 16, by0, BODY_MID)
    rect_outline(c, bx0, by0 - 6, bx0 + 16, by0, BLACK)
    hline(c, by0 - 6, bx0 + 1, bx0 + 15, BODY_HI)
    dither_rect(c, bx0 + 1, by0 - 5, bx0 + 15, by0 - 3, BODY_MID, BODY_LT, "checker")

    rect(c, bx1 - 16, by0 - 6, bx1, by0, BODY_MID)
    rect_outline(c, bx1 - 16, by0 - 6, bx1, by0, BLACK)
    hline(c, by0 - 6, bx1 - 15, bx1 - 1, BODY_HI)
    dither_rect(c, bx1 - 15, by0 - 5, bx1 - 1, by0 - 3, BODY_MID, BODY_LT, "checker")

    # Screen bezel
    rect(c, 14, 15, 50, 47, DARK_BEVEL)
    rect_outline(c, 14, 15, 50, 47, BLACK)
    # Screen
    sc_x0, sc_y0, sc_x1, sc_y1 = 16, 17, 48, 45
    rect(c, sc_x0, sc_y0, sc_x1, sc_y1, SCR_DARK)
    dither_gradient_rect(c, sc_x0, sc_y0, sc_x1, sc_y1, SCR_GLOW, SCR_DARK, steps=5)
    # Screen highlight corner
    for hy in range(sc_y0, sc_y0 + 6):
        for hx in range(sc_x0, sc_x0 + 9):
            if hx - sc_x0 + hy - sc_y0 < 8:
                existing = c[hy, hx].copy()
                blend = (8 - (hx-sc_x0 + hy-sc_y0)) / 8.0 * 0.45
                c[hy, hx] = (
                    min(255, int(existing[0] + 80*blend)),
                    min(255, int(existing[1] + 130*blend)),
                    min(255, int(existing[2] + 200*blend)),
                    255
                )
    rect_outline(c, sc_x0, sc_y0, sc_x1, sc_y1, BLACK)

    # D-pad — left side
    dp_cx, dp_cy = 8, 33
    rect(c, dp_cx - 4, dp_cy - 2, dp_cx + 4, dp_cy + 2, BLACK)
    rect(c, dp_cx - 2, dp_cy - 4, dp_cx + 2, dp_cy + 4, BLACK)
    rect(c, dp_cx - 3, dp_cy - 1, dp_cx + 3, dp_cy + 1, DPAD_F)
    rect(c, dp_cx - 1, dp_cy - 3, dp_cx + 1, dp_cy + 3, DPAD_F)
    px(c, dp_cx, dp_cy - 3, BODY_HI)
    px(c, dp_cx - 3, dp_cy, BODY_HI)

    # A button — RIGHT, large red (GBA A button was prominent)
    circle_fill(c, 58, 26, 5, BLACK)
    circle_fill(c, 58, 26, 4, BTN_A)
    px(c, 56, 24, BTN_A_HI)
    px(c, 57, 23, BTN_A_HI)

    # B button — below and left of A
    circle_fill(c, 52, 33, 4, BLACK)
    circle_fill(c, 52, 33, 3, BTN_B)
    px(c, 50, 32, BTN_A_HI)

    # Select / Start
    for bx in [25, 32]:
        rect(c, bx - 2, 42, bx + 2, 44, DARK_BEVEL)
        rect_outline(c, bx - 2, 42, bx + 2, 44, BLACK)
        hline(c, 42, bx - 1, bx + 1, BODY_MID)

    # Power LED
    px(c, 4, 18, (255, 80, 80, 255))
    px(c, 4, 19, (180, 28, 28, 255))

    save_icon(c, "gba")
    print("GBA v2 done")


# ─────────────────────────────────────────────────────────────────────────────
# COMPARISON SHEET — rebuild with updated v2 icons
# ─────────────────────────────────────────────────────────────────────────────
def make_comparison_sheet():
    import os
    systems = ["nes", "snes", "n64", "gb", "gbc", "gba", "genesis", "mastersystem", "arcade", "psx", "psp"]

    icon_size = 64
    padding = 10
    label_h = 16
    row_h = icon_size + label_h + padding * 2

    # 2-column layout, 6 rows
    col_w = icon_size * 2 + padding * 3 + 24
    sheet_w = col_w * 2 + padding * 3
    sheet_h = row_h * 6 + padding * 2

    sheet = Image.new("RGBA", (sheet_w, sheet_h), (22, 20, 30, 255))

    try:
        from PIL import ImageDraw, ImageFont
        draw = ImageDraw.Draw(sheet)
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 10)
            font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9)
            font_label = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 8)
        except:
            font = ImageFont.load_default()
            font_sm = font
            font_label = font
    except Exception as e:
        print(f"Font error: {e}")
        return

    for i, slug in enumerate(systems):
        col = i % 2
        row = i // 2

        base_x = padding + col * (col_w + padding)
        base_y = padding + row * row_h

        # System name label
        draw.text((base_x, base_y + 2), slug.upper(), fill=(190, 178, 215, 255), font=font)

        img_y = base_y + label_h

        # V1 icon
        v1_backup = f"/tmp/cartdex_v1_backup/{slug}-64.png"
        if os.path.exists(v1_backup):
            v1 = Image.open(v1_backup).resize((icon_size, icon_size), Image.NEAREST)
        else:
            v1 = Image.new("RGBA", (icon_size, icon_size), (50, 45, 70, 255))

        v1_x = base_x
        draw.text((v1_x, img_y - 1), "v1", fill=(130, 120, 155, 255), font=font_label)
        sheet.paste(v1, (v1_x, img_y + 9), v1)

        # Arrow
        arr_x = v1_x + icon_size + 6
        draw.text((arr_x + 1, img_y + icon_size // 2), "->", fill=(210, 185, 100, 255), font=font_sm)

        # V2 icon
        v2_path = os.path.join(OUT_DIR, f"{slug}-64.png")
        if os.path.exists(v2_path):
            v2 = Image.open(v2_path).resize((icon_size, icon_size), Image.NEAREST)
        else:
            v2 = Image.new("RGBA", (icon_size, icon_size), (70, 55, 95, 255))

        v2_x = arr_x + 20
        draw.text((v2_x, img_y - 1), "v2", fill=(120, 210, 130, 255), font=font_label)
        sheet.paste(v2, (v2_x, img_y + 9), v2)

    sheet.save("/home/claude/projects/DOCS/Projects/cartdex/icon-v1-v2-comparison.png")
    print("Comparison sheet saved.")


if __name__ == "__main__":
    print("=== Cartdex Icon v2 Pass 2 ===")
    draw_n64_v2()
    draw_snes_v2()
    draw_psx_v2()
    draw_mastersystem_v2()
    draw_gba_v2()
    print("\nRebuilding comparison sheet...")
    make_comparison_sheet()
    print("Done.")
