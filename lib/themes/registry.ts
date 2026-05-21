import type { ThemePack } from "./types";
import { snesPack } from "./snes";
import { tatooInePack } from "./tatooine";

// To add a new theme: create a new file in lib/themes/, export a ThemePack,
// import it here, and append to this array. No component changes needed.
export const themes: ThemePack[] = [snesPack, tatooInePack];

export const DEFAULT_THEME_ID = "snes";

export type ThemeId = "snes" | "tatooine";

export function getTheme(id: string): ThemePack {
  return themes.find((t) => t.id === id) ?? snesPack;
}

export function isValidThemeId(id: string): id is ThemeId {
  return themes.some((t) => t.id === id);
}
