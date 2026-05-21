#!/usr/bin/env python3
"""
Cartdex Icon v2 — Pass 3: Final tightening
- PSX: stronger grip contrast, face buttons larger
- GBC: purple shell is the hero, screen is secondary
- N64: C-buttons fewer/bigger, cleaner at 32px
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
        r  = int(color_top[0] * (1 - t0) + color_bot[0] * t0)
        g  = int(color_top[1] * (1 - t0) + color_bot[1] * t0)
        b  = int(color_top[2] * (1 - t0) + color_bot[2] * t0)
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
# PSX Pass 3 — Grips much darker vs body; face buttons pushed larger
# Key insight: at 32px the grip/body boundary must be a hard contrast edge
# ─────────────────────────────────────────────────────────────────────────────
def draw_psx_v3():
    S = 64
    c = new_canvas(S)

    BLACK      = (8,  8, 10, 255)
    BODY_DARK  = (75, 72, 80, 255)
    BODY_MID   = (115, 112, 122, 255)
    BODY_LT    = (158, 155, 166, 255)
    BODY_HI    = (198, 196, 208, 255)
    BODY_SPEC  = (228, 226, 234, 255)
    # Grips much darker than body — creates the silhouette read at 32px
    GRIP_DARK  = (30, 28, 34, 255)
    GRIP_MID   = (52, 50, 58, 255)
    GRIP_LT    = (72, 70, 80, 255)
    GRIP_HI    = (95, 92, 105, 255)
    # PSX face button colors
    PS_TRI     = (25, 185, 120, 255)
    PS_CIR     = (200, 30, 52, 255)
    PS_CRO     = (42, 75, 210, 255)
    PS_SQR     = (200, 48, 172, 255)
    PS_TRI_HI  = (85, 225, 160, 255)
    PS_CIR_HI  = (240, 88, 95, 255)
    PS_CRO_HI  = (100, 145, 240, 255)
    PS_SQR_HI  = (230, 105, 200, 255)
    STICK_RIM  = (45, 43, 50, 255)
    STICK_CAP  = (68, 65, 75, 255)
    DARK_FACE  = (55, 52, 60, 255)
    GREY_DPAD  = (70, 68, 78, 255)
    DPAD_F     = (95, 92, 105, 255)

    # Top body — lighter grey band
    bx0, by0, bx1, by1 = 2, 14, 61, 40
    dither_gradient_rect(c, bx0, by0, bx1, by1, BODY_LT, BODY_DARK, steps=5)
    hline(c, by0,     bx0+2, bx1-2, BODY_SPEC)
    hline(c, by0+1,   bx0+2, bx1-2, BODY_HI)
    hline(c, by0+2,   bx0+2, bx1-2, BODY_LT)
    dither_rect(c, bx0+2, by0+3, bx1-2, by0+5, BODY_MID, BODY_LT, "checker")
    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    # === LEFT GRIP — very dark, droops down distinctly ===
    lg_x0, lg_y0, lg_x1, lg_y1 = 2, 34, 20, 60
    dither_gradient_rect(c, lg_x0, lg_y0, lg_x1, lg_y1, GRIP_LT, GRIP_DARK, steps=4)
    # Left edge highlight
    vline(c, lg_x0+1, lg_y0, lg_y1, GRIP_HI)
    dither_rect(c, lg_x0+2, lg_y0, lg_x0+3, lg_y1, GRIP_MID, GRIP_LT, "checker")
    rect_outline(c, lg_x0, lg_y0, lg_x1, lg_y1, BLACK)

    # === RIGHT GRIP — very dark, droops down ===
    rg_x0, rg_y0, rg_x1, rg_y1 = 43, 34, 61, 60
    dither_gradient_rect(c, rg_x0, rg_y0, rg_x1, rg_y1, GRIP_LT, GRIP_DARK, steps=4)
    vline(c, rg_x1-1, rg_y0, rg_y1, GRIP_HI)
    dither_rect(c, rg_x1-3, rg_y0, rg_x1-2, rg_y1, GRIP_MID, GRIP_LT, "checker")
    rect_outline(c, rg_x0, rg_y0, rg_x1, rg_y1, BLACK)

    # Gap between grips — near-black pit (the notch that makes it a DualShock)
    rect(c, 21, 40, 42, 60, (12, 11, 14, 255))
    # Slight gradient into the gap
    for gy in range(40, 48):
        t = (gy - 40) / 8.0
        shade = int(35 * (1 - t))
        hline(c, gy, 21, 42, (shade, shade, shade+4, 255))

    # L1/R1 shoulder bumps
    rect(c, bx0, by0-5, bx0+14, by0, BODY_MID)
    rect_outline(c, bx0, by0-5, bx0+14, by0, BLACK)
    hline(c, by0-5, bx0+1, bx0+13, BODY_HI)
    dither_rect(c, bx0+1, by0-4, bx0+13, by0-2, BODY_MID, BODY_LT, "checker")

    rect(c, bx1-14, by0-5, bx1, by0, BODY_MID)
    rect_outline(c, bx1-14, by0-5, bx1, by0, BLACK)
    hline(c, by0-5, bx1-13, bx1-1, BODY_HI)
    dither_rect(c, bx1-13, by0-4, bx1-1, by0-2, BODY_MID, BODY_LT, "checker")

    # D-pad
    dp_cx, dp_cy = 13, 26
    rect(c, dp_cx-5, dp_cy-2, dp_cx+5, dp_cy+2, BLACK)
    rect(c, dp_cx-2, dp_cy-5, dp_cx+2, dp_cy+5, BLACK)
    rect(c, dp_cx-4, dp_cy-1, dp_cx+4, dp_cy+1, DPAD_F)
    rect(c, dp_cx-1, dp_cy-4, dp_cx+1, dp_cy+4, DPAD_F)
    hline(c, dp_cy-4, dp_cx-1, dp_cx+1, BODY_HI)
    px(c, dp_cx-4, dp_cy, BODY_HI)

    # Left analog stick (in left grip)
    circle_fill(c, 11, 46, 5, BLACK)
    circle_fill(c, 11, 46, 4, STICK_RIM)
    circle_fill(c, 11, 46, 3, STICK_CAP)
    dither_rect(c, 8, 43, 14, 49, STICK_RIM, STICK_CAP, "checker")
    circle_fill(c, 11, 46, 5, BLACK)
    px(c, 10, 44, GRIP_HI)

    # Right analog stick (in right grip)
    circle_fill(c, 52, 46, 5, BLACK)
    circle_fill(c, 52, 46, 4, STICK_RIM)
    circle_fill(c, 52, 46, 3, STICK_CAP)
    dither_rect(c, 49, 43, 55, 49, STICK_RIM, STICK_CAP, "checker")
    circle_fill(c, 52, 46, 5, BLACK)
    px(c, 51, 44, GRIP_HI)

    # ====================================================================
    # PSX FACE BUTTONS — bigger, more vivid
    # Diamond arrangement: Triangle top, Circle right, X bottom, Square left
    # ====================================================================
    btn_cx, btn_cy = 50, 25

    # Triangle (top) — vivid teal, solid triangle
    tri_pts = [(btn_cx, btn_cy-7), (btn_cx-4, btn_cy-1), (btn_cx+4, btn_cy-1)]
    for row in range(7):
        w = row
        y_pos = btn_cy - 7 + row
        if w == 0:
            px(c, btn_cx, y_pos, PS_TRI)
        else:
            hline(c, y_pos, btn_cx - w + 1, btn_cx + w - 1, PS_TRI)
    px(c, btn_cx, btn_cy-7, PS_TRI_HI)
    px(c, btn_cx-1, btn_cy-6, PS_TRI_HI)

    # Circle (right) — red, size 3
    circle_fill(c, btn_cx+7, btn_cy, 4, BLACK)
    circle_fill(c, btn_cx+7, btn_cy, 3, PS_CIR)
    px(c, btn_cx+6, btn_cy-1, PS_CIR_HI)
    px(c, btn_cx+5, btn_cy-2, PS_CIR_HI)

    # X (bottom) — blue cross, thicker
    x_cx, x_cy = btn_cx, btn_cy+7
    for d in range(-3, 4):
        px(c, x_cx+d, x_cy+d, PS_CRO)
        px(c, x_cx+d, x_cy-d, PS_CRO)
    for d in range(-2, 3):
        px(c, x_cx+d, x_cy+d-1, PS_CRO)
        px(c, x_cx+d, x_cy-d-1, PS_CRO)
    px(c, x_cx-2, x_cy-2, PS_CRO_HI)

    # Square (left) — pink, 5x5 filled
    rect(c, btn_cx-11, btn_cy-3, btn_cx-4, btn_cy+3, BLACK)
    rect(c, btn_cx-10, btn_cy-2, btn_cx-5, btn_cy+2, PS_SQR)
    hline(c, btn_cy-2, btn_cx-10, btn_cx-5, PS_SQR_HI)
    px(c, btn_cx-10, btn_cy-2, PS_SQR_HI)
    px(c, btn_cx-10, btn_cy-1, PS_SQR_HI)

    # Select / Start
    for bx in [29, 35]:
        rect(c, bx-2, 22, bx+2, 24, BLACK)
        rect(c, bx-1, 22, bx+1, 24, DARK_FACE)

    save_icon(c, "psx")
    print("PSX v3 done")


# ─────────────────────────────────────────────────────────────────────────────
# GBC Pass 3 — PURPLE SHELL is the hero, not the screen
# The GBC was the first Nintendo product in bold translucent colors.
# Make the purple body saturated and rich; screen is a supporting detail.
# ─────────────────────────────────────────────────────────────────────────────
def draw_gbc_v3():
    S = 64
    c = new_canvas(S)

    BLACK      = (8,  8, 10, 255)
    # Grape/atomic purple — richest GBC colorway
    BODY_DARK  = (62, 32, 108, 255)
    BODY_MID   = (102, 55, 168, 255)
    BODY_LT    = (148, 95, 215, 255)
    BODY_HI    = (185, 138, 238, 255)
    BODY_SPEC  = (215, 175, 252, 255)
    # Screen — more subdued than GBC v2, shell wins
    SCR_DARK   = (18, 15, 30, 255)
    SCR_MID    = (45, 65, 135, 255)
    SCR_GLOW   = (80, 115, 195, 255)
    DARK_BEZEL = (35, 18, 62, 255)
    # Buttons — GBC had colorful buttons on the purple model
    BTN_A      = (200, 30, 42, 255)
    BTN_B      = (200, 30, 42, 255)
    BTN_A_HI   = (240, 88, 88, 255)
    GREY_DPAD  = (75, 45, 118, 255)
    DPAD_F     = (108, 72, 158, 255)
    DPAD_HI    = (155, 115, 200, 255)
    IR_PORT    = (58, 25, 25, 255)
    DARK_STRIP = (30, 15, 55, 255)
    START_SEL  = (55, 30, 88, 255)

    # Portrait body — slightly rounder at top than GB
    bx0, by0, bx1, by1 = 10, 2, 53, 61

    # Rich purple gradient — top is lighter (light source overhead)
    dither_gradient_rect(c, bx0, by0, bx1, by1, BODY_LT, BODY_DARK, steps=6)

    # Top specular — catches the light
    hline(c, by0,   bx0+3, bx1-3, BODY_SPEC)
    hline(c, by0+1, bx0+2, bx1-2, BODY_HI)
    hline(c, by0+2, bx0+2, bx1-2, BODY_LT)
    dither_rect(c, bx0+2, by0+3, bx1-2, by0+5, BODY_MID, BODY_LT, "checker")

    # Side highlights — the translucent shell catches side light
    vline(c, bx0+1, by0+4, by1-4, BODY_HI)
    dither_rect(c, bx0+2, by0+4, bx0+3, by1-4, BODY_MID, BODY_LT, "checker")
    vline(c, bx1-1, by0+4, by1-4, BODY_HI)
    dither_rect(c, bx1-3, by0+4, bx1-2, by1-4, BODY_MID, BODY_LT, "checker")

    # Rounded top corners
    px(c, bx0, by0, (0,0,0,0))
    px(c, bx0+1, by0, (0,0,0,0))
    px(c, bx0, by0+1, (0,0,0,0))
    px(c, bx1, by0, (0,0,0,0))
    px(c, bx1-1, by0, (0,0,0,0))
    px(c, bx1, by0+1, (0,0,0,0))

    rect_outline(c, bx0, by0, bx1, by1, BLACK)

    # Infrared port — top center (GBC had a red IR eye)
    rect(c, 27, 2, 36, 5, IR_PORT)
    rect_outline(c, 27, 2, 36, 5, BLACK)
    hline(c, 3, 28, 35, (110, 42, 42, 255))
    hline(c, 4, 28, 35, (78, 28, 28, 255))

    # Screen bezel — dark purple, not black (shell color bleeds in)
    bz_x0, bz_y0, bz_x1, bz_y1 = 13, 7, 50, 36
    rect(c, bz_x0, bz_y0, bz_x1, bz_y1, DARK_BEZEL)
    rect_outline(c, bz_x0, bz_y0, bz_x1, bz_y1, BLACK)

    # Screen — clear and readable but not the dominant element
    sc_x0, sc_y0, sc_x1, sc_y1 = 15, 9, 48, 34
    rect(c, sc_x0, sc_y0, sc_x1, sc_y1, SCR_DARK)
    dither_gradient_rect(c, sc_x0, sc_y0, sc_x1, sc_y1, SCR_GLOW, SCR_DARK, steps=4)
    # Small highlight only
    for hy in range(sc_y0, sc_y0+4):
        for hx in range(sc_x0, sc_x0+6):
            if hx - sc_x0 + hy - sc_y0 < 5:
                existing = c[hy, hx].copy()
                blend = (5 - (hx-sc_x0 + hy-sc_y0)) / 5.0 * 0.35
                c[hy, hx] = (
                    min(255, int(existing[0] + 80*blend)),
                    min(255, int(existing[1] + 120*blend)),
                    min(255, int(existing[2] + 200*blend)),
                    255
                )
    rect_outline(c, sc_x0, sc_y0, sc_x1, sc_y1, BLACK)

    # Power LED — the little red dot on the bezel
    px(c, bz_x1-2, bz_y0+2, (255, 55, 55, 255))
    px(c, bz_x1-2, bz_y0+3, (200, 20, 20, 255))

    # "GAME BOY COLOR" label bar suggestion below screen
    # (the physical unit has this label between screen and controls)
    hline(c, bz_y1+2, bx0+3, bx1-3, BODY_HI)
    dither_rect(c, bx0+3, bz_y1+3, bx1-3, bz_y1+4, BODY_MID, BODY_LT, "quarter_a")

    # D-pad — strong purple-tinted cross
    dp_cx, dp_cy = 21, 48
    rect(c, dp_cx-6, dp_cy-2, dp_cx+6, dp_cy+2, BLACK)
    rect(c, dp_cx-2, dp_cy-6, dp_cx+2, dp_cy+6, BLACK)
    rect(c, dp_cx-5, dp_cy-1, dp_cx+5, dp_cy+1, DPAD_F)
    rect(c, dp_cx-1, dp_cy-5, dp_cx+1, dp_cy+5, DPAD_F)
    rect(c, dp_cx-1, dp_cy-1, dp_cx+1, dp_cy+1, DPAD_HI)
    hline(c, dp_cy-5, dp_cx-1, dp_cx+1, DPAD_HI)
    px(c, dp_cx-5, dp_cy, DPAD_HI)

    # Select / Start — small pill buttons
    for bx in [28, 36]:
        rect(c, bx-3, 51, bx+3, 53, BLACK)
        rect(c, bx-2, 51, bx+2, 53, START_SEL)
        hline(c, 51, bx-1, bx+1, DPAD_F)

    # A + B buttons — bright red circles (pop against purple shell)
    # B button (left)
    circle_fill(c, 36, 47, 5, BLACK)
    circle_fill(c, 36, 47, 4, BTN_B)
    px(c, 34, 45, BTN_A_HI)
    px(c, 35, 44, BTN_A_HI)

    # A button (right, slightly higher = diagonal like GB)
    circle_fill(c, 44, 43, 5, BLACK)
    circle_fill(c, 44, 43, 4, BTN_A)
    px(c, 42, 41, BTN_A_HI)
    px(c, 43, 40, BTN_A_HI)

    # Speaker grill — dot pattern bottom right
    for gy in range(56, 61, 2):
        for gx in range(38, 52, 2):
            if gx < bx1 - 1 and gy < by1 - 1:
                px(c, gx, gy, BODY_DARK)

    save_icon(c, "gbc")
    print("GBC v3 done")


# ─────────────────────────────────────────────────────────────────────────────
# N64 Pass 3 — C-buttons: 4 larger dots instead of tiny cluster
# Also: cleaner center spine, analog stick more prominent
# ─────────────────────────────────────────────────────────────────────────────
def draw_n64_v3():
    S = 64
    c = new_canvas(S)

    BLACK      = (10, 10, 12, 255)
    BODY_DARK  = (60, 56, 66, 255)
    BODY_MID   = (95, 90, 105, 255)
    BODY_LT    = (138, 130, 150, 255)
    BODY_HI    = (178, 170, 192, 255)
    BODY_SPEC  = (208, 202, 220, 255)
    YELLOW_C   = (218, 188, 12, 255)
    YELLOW_HI  = (255, 228, 80, 255)
    GREEN_A    = (28, 162, 58, 255)
    GREEN_HI   = (75, 210, 105, 255)
    RED_B      = (202, 28, 28, 255)
    RED_HI     = (242, 80, 80, 255)
    GREY_DPAD  = (70, 66, 78, 255)
    DPAD_F     = (98, 92, 110, 255)
    ANALOG_RIM = (45, 42, 52, 255)
    ANALOG_CAP = (78, 74, 88, 255)

    # Center body
    cx0, cy0, cx1, cy1 = 16, 10, 48, 40
    dither_gradient_rect(c, cx0, cy0, cx1, cy1, BODY_LT, BODY_DARK, steps=5)
    hline(c, cy0,   cx0+1, cx1-1, BODY_SPEC)
    hline(c, cy0+1, cx0+1, cx1-1, BODY_HI)
    hline(c, cy0+2, cx0+1, cx1-1, BODY_LT)
    dither_rect(c, cx0+1, cy0+3, cx1-1, cy0+4, BODY_MID, BODY_LT, "checker")

    # Left grip
    lx0, ly0, lx1, ly1 = 4, 22, 20, 58
    dither_gradient_rect(c, lx0, ly0, lx1, ly1, BODY_LT, BODY_DARK, steps=4)
    hline(c, ly0,   lx0+1, lx1-1, BODY_HI)
    vline(c, lx0+1, ly0+2, ly1-2, BODY_HI)
    dither_rect(c, lx0+2, ly0+2, lx0+3, ly1-2, BODY_MID, BODY_LT, "checker")

    # Right grip
    rx0, ry0, rx1, ry1 = 44, 22, 60, 58
    dither_gradient_rect(c, rx0, ry0, rx1, ry1, BODY_LT, BODY_DARK, steps=4)
    hline(c, ry0,   rx0+1, rx1-1, BODY_HI)
    vline(c, rx1-1, ry0+2, ry1-2, BODY_HI)
    dither_rect(c, rx1-3, ry0+2, rx1-2, ry1-2, BODY_MID, BODY_LT, "checker")

    # Center grip (middle prong — the N64 identifier)
    mx0, my0, mx1, my1 = 24, 38, 40, 60
    dither_gradient_rect(c, mx0, my0, mx1, my1, BODY_MID, BODY_DARK, steps=3)
    hline(c, my0, mx0+1, mx1-1, BODY_LT)

    # Outlines
    rect_outline(c, cx0, cy0, cx1, cy1, BLACK)
    rect_outline(c, lx0, ly0, lx1, ly1, BLACK)
    rect_outline(c, rx0, ry0, rx1, ry1, BLACK)
    rect_outline(c, mx0, my0, mx1, my1, BLACK)

    # Cartridge slot
    rect(c, 26, cy0, 38, cy0+7, BLACK)
    hline(c, cy0+1, 27, 37, BODY_DARK)
    hline(c, cy0+3, 27, 37, BODY_DARK)
    hline(c, cy0+5, 27, 37, BODY_DARK)

    # === ANALOG STICK — LEFT GRIP — make it read clearly ===
    as_cx, as_cy = 12, 32
    # Wide base plate
    circle_fill(c, as_cx, as_cy+2, 5, BLACK)
    circle_fill(c, as_cx, as_cy+2, 4, ANALOG_RIM)
    # Stick gate (octagon suggest)
    for angle_pair in [(-4,0),(4,0),(0,-4),(0,4),(-3,-3),(3,-3),(-3,3),(3,3)]:
        px(c, as_cx+angle_pair[0], as_cy+2+angle_pair[1], BODY_DARK)
    # Stick cap — lighter circle
    circle_fill(c, as_cx, as_cy, 4, BLACK)
    circle_fill(c, as_cx, as_cy, 3, ANALOG_RIM)
    circle_fill(c, as_cx, as_cy, 2, ANALOG_CAP)
    # Rubber texture (dither)
    dither_rect(c, as_cx-2, as_cy-2, as_cx+2, as_cy+2, ANALOG_RIM, ANALOG_CAP, "checker")
    circle_fill(c, as_cx, as_cy, 4, BLACK)
    for ry in range(as_cy-3, as_cy+4):
        for rx in range(as_cx-3, as_cx+4):
            dist = ((rx-as_cx)**2 + (ry-as_cy)**2)**0.5
            if 1.5 < dist <= 3.0:
                existing = c[ry, rx].copy()
                if existing[3] > 0:
                    c[ry, rx] = ANALOG_RIM if (rx+ry)%2==0 else ANALOG_CAP
    px(c, as_cx-1, as_cy-2, BODY_HI)
    px(c, as_cx, as_cy-2, BODY_HI)

    # D-pad — center body left area, compact
    dp_cx, dp_cy = 26, 28
    rect(c, dp_cx-4, dp_cy-1, dp_cx+4, dp_cy+1, BLACK)
    rect(c, dp_cx-1, dp_cy-4, dp_cx+1, dp_cy+4, BLACK)
    rect(c, dp_cx-3, dp_cy-1, dp_cx+3, dp_cy+1, DPAD_F)
    rect(c, dp_cx-1, dp_cy-3, dp_cx+1, dp_cy+3, DPAD_F)
    px(c, dp_cx, dp_cy-3, BODY_HI)
    px(c, dp_cx-3, dp_cy, BODY_HI)

    # Start — center body
    circle_fill(c, 32, 22, 3, BLACK)
    circle_fill(c, 32, 22, 2, BODY_MID)
    px(c, 31, 21, BODY_HI)

    # === C-BUTTONS — RIGHT GRIP — 4 bigger yellow circles in a cross ===
    # Bigger = more readable at 32px. Classic arcade button feel.
    cy_cx, cy_cy = 52, 30
    for dx, dy in [(0, -6), (6, 0), (0, 6), (-6, 0)]:
        circle_fill(c, cy_cx+dx, cy_cy+dy, 4, BLACK)
        circle_fill(c, cy_cx+dx, cy_cy+dy, 3, YELLOW_C)
        px(c, cy_cx+dx-1, cy_cy+dy-2, YELLOW_HI)

    # === A BUTTON — large green, right grip lower ===
    circle_fill(c, 52, 42, 5, BLACK)
    circle_fill(c, 52, 42, 4, GREEN_A)
    px(c, 50, 40, GREEN_HI)
    px(c, 51, 39, GREEN_HI)

    # B button — smaller red
    circle_fill(c, 46, 48, 3, BLACK)
    circle_fill(c, 46, 48, 2, RED_B)
    px(c, 45, 47, RED_HI)

    # Z trigger on center prong
    rect(c, mx0+2, my1-7, mx1-2, my1-4, BLACK)
    hline(c, my1-6, mx0+3, mx1-3, BODY_DARK)
    hline(c, my1-5, mx0+3, mx1-3, BODY_MID)

    save_icon(c, "n64")
    print("N64 v3 done")


# ─────────────────────────────────────────────────────────────────────────────
# COMPARISON SHEET REBUILD
# ─────────────────────────────────────────────────────────────────────────────
def make_comparison_sheet():
    systems = ["nes", "snes", "n64", "gb", "gbc", "gba", "genesis", "mastersystem", "arcade", "psx", "psp"]

    icon_size = 64
    padding = 10
    label_h = 16
    row_h = icon_size + label_h + padding * 2

    col_w = icon_size * 2 + padding * 3 + 26
    sheet_w = col_w * 2 + padding * 3
    sheet_h = row_h * 6 + padding * 2

    sheet = Image.new("RGBA", (sheet_w, sheet_h), (18, 16, 26, 255))

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

    for i, slug in enumerate(systems):
        col = i % 2
        row = i // 2
        base_x = padding + col * (col_w + padding)
        base_y = padding + row * row_h

        draw.text((base_x, base_y + 2), slug.upper(), fill=(188, 175, 215, 255), font=font)
        img_y = base_y + label_h

        v1_backup = f"/tmp/cartdex_v1_backup/{slug}-64.png"
        v1 = Image.open(v1_backup).resize((icon_size, icon_size), Image.NEAREST) if os.path.exists(v1_backup) else Image.new("RGBA", (icon_size, icon_size), (50, 45, 70, 255))

        v1_x = base_x
        draw.text((v1_x, img_y - 1), "v1", fill=(128, 118, 152, 255), font=font_label)
        sheet.paste(v1, (v1_x, img_y + 9), v1)

        arr_x = v1_x + icon_size + 4
        draw.text((arr_x + 1, img_y + icon_size // 2), "->", fill=(210, 185, 95, 255), font=font_sm)

        v2_path = os.path.join(OUT_DIR, f"{slug}-64.png")
        v2 = Image.open(v2_path).resize((icon_size, icon_size), Image.NEAREST) if os.path.exists(v2_path) else Image.new("RGBA", (icon_size, icon_size), (70, 55, 95, 255))

        v2_x = arr_x + 22
        draw.text((v2_x, img_y - 1), "v2", fill=(118, 210, 128, 255), font=font_label)
        sheet.paste(v2, (v2_x, img_y + 9), v2)

    sheet.save("/home/claude/projects/DOCS/Projects/cartdex/icon-v1-v2-comparison.png")
    print("Comparison sheet saved.")


if __name__ == "__main__":
    print("=== Cartdex Icon v2 Pass 3 ===")
    draw_psx_v3()
    draw_gbc_v3()
    draw_n64_v3()
    print("\nRebuilding comparison sheet...")
    make_comparison_sheet()
    print("Done.")
