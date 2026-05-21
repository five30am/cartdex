/**
 * Genesis theme stub — placeholder for acceptance criteria verification.
 * Adding this file + appending to registry.ts makes it appear in the picker
 * without any component changes. Tokens are incomplete placeholders.
 * Do NOT ship this theme in v1 — remove or complete before enabling.
 *
 * To enable: import genesisPackStub and append to the themes array in registry.ts.
 */

import type { ThemePack } from "./types";

export const genesisPackStub: ThemePack = {
  id: "genesis",
  name: "Genesis",
  description: "Sega Genesis / Mega Drive aesthetic. Placeholder — not yet complete.",
  dark: {
    colors: {
      background:   "#0a0a0a",
      panel:        "#111111",
      card:         "#1a1a1a",
      border:       "#2a2a2a",
      borderActive: "#3f51b5",
      primary:      "#3f51b5",
      primaryDeep:  "#283593",
      text:         "#e0e0e0",
      textDim:      "#9e9e9e",
      textFaint:    "#616161",
      textBright:   "#ffffff",
      success:      "#43a047",
      warning:      "#fb8c00",
      danger:       "#e53935",
      info:         "#1e88e5",
      shadow:       "#000000",
    },
    fonts: {
      heading: "'Share Tech Mono', monospace",
      body:    "'Share Tech Mono', monospace",
      mono:    "'Share Tech Mono', monospace",
    },
    radius: {
      none: "0px",
      sm:   "0px",
      md:   "2px",
      lg:   "4px",
      full: "0px",
    },
    shadow: {
      card:      "2px 2px 0 0 #000000",
      cardHover: "3px 3px 0 0 #000000",
      glow:      "none",
    },
    motifs: {
      divider:         "rule",
      statusBarText:   "SEGA GENESIS / MEGA DRIVE",
      cardBorderWidth: "1px",
      scanlines:       true,
      scanlinesOpacity: "0.04",
    },
    googleFonts: ["Share Tech Mono"],
  },
};
