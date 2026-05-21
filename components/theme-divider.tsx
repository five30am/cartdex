"use client";

import { useTheme } from "@/components/theme-provider";
import { getTheme } from "@/lib/themes/registry";

/**
 * ThemeDivider renders the correct section separator for the active theme.
 *
 * SNES: cartridge-slot notch (two horizontal rules + accent square)
 * Tatooine: simple horizontal rule
 * none: renders nothing
 */
export function ThemeDivider() {
  const { theme } = useTheme();
  const pack = getTheme(theme);
  const motif = pack.dark.motifs.divider;

  if (motif === "notch") {
    return (
      <div className="cd-divider" role="separator">
        <div className="cd-divider-notch" />
      </div>
    );
  }

  if (motif === "rule") {
    return (
      <hr
        role="separator"
        style={{
          border: "none",
          borderTop: "1px solid var(--cd-border)",
          margin: "var(--cd-space-10, 40px) 0",
          opacity: 0.6,
        }}
      />
    );
  }

  return null;
}
