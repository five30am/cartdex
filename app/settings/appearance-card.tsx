"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Palette, Check } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { themes, type ThemeId } from "@/lib/themes/registry";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  const [pending, setPending] = useState<ThemeId | null>(null);

  async function handleSelect(id: ThemeId) {
    if (id === theme || pending) return;
    setPending(id);
    try {
      await setTheme(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save theme preference.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="bg-card border-border shadow-none overflow-hidden" style={{ borderRadius: "var(--cd-radius-md, 0.375rem)" }}>
      <CardHeader className="px-5 pt-4 pb-0">
        <div className="flex items-center gap-2.5">
          <div className="text-muted-foreground">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Appearance</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose a theme. Your preference is saved across devices.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pt-4 pb-5">
        <div className="border-t border-border pt-4">
          <div
            role="radiogroup"
            aria-label="Application theme"
            className="flex flex-wrap gap-4"
          >
            {themes.map((pack) => {
              const isSelected = theme === pack.id;
              const isPending = pending === pack.id;

              return (
                <button
                  key={pack.id}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${pack.name} theme${isSelected ? ", currently selected" : ""}`}
                  disabled={!!pending}
                  onClick={() => handleSelect(pack.id as ThemeId)}
                  style={{
                    outline: "none",
                    border: isSelected
                      ? `2px solid var(--cd-accent-primary, var(--primary))`
                      : `1px solid var(--cd-border, var(--border))`,
                    borderRadius: "var(--cd-radius-md, 0.375rem)",
                    background: "transparent",
                    cursor: pending ? "wait" : "pointer",
                    padding: 0,
                    position: "relative",
                    transition: "border-color 0.15s ease",
                    width: "240px",
                  }}
                  className={cn(
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                    "focus-visible:outline-current"
                  )}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(pack.id as ThemeId);
                    }
                  }}
                >
                  {/* Checkmark overlay */}
                  {isSelected && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        width: "20px",
                        height: "20px",
                        borderRadius: "var(--cd-radius-full, 9999px)",
                        background: "var(--cd-accent-primary, var(--primary))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 2,
                      }}
                    >
                      <Check style={{ width: "12px", height: "12px", color: "white", strokeWidth: 3 }} />
                    </span>
                  )}

                  {/* Theme mini-mock preview (4:3 ratio, 240x180) */}
                  <ThemeMiniMock themeId={pack.id as ThemeId} isPending={isPending} />

                  {/* Theme name label */}
                  <div
                    style={{
                      padding: "8px 12px 10px",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected
                          ? "var(--cd-text, var(--foreground))"
                          : "var(--cd-text-dim, var(--muted-foreground))",
                        fontFamily: "var(--cd-font-body, inherit)",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                      }}
                    >
                      {pack.name}
                    </span>
                    {isPending && (
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.625rem",
                          color: "var(--cd-text-faint, var(--muted-foreground))",
                          marginTop: "2px",
                        }}
                      >
                        Applying...
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4" style={{ opacity: 0.6 }}>
            When a new theme is available, it appears here.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ThemeMiniMock renders a scaled-down HTML preview of the theme.
 * Uses the theme's actual CSS variables by applying data-theme attribute
 * to an isolated container, so the preview is always accurate.
 */
function ThemeMiniMock({ themeId, isPending }: { themeId: ThemeId; isPending: boolean }) {
  return (
    <div
      style={{
        width: "240px",
        height: "180px",
        overflow: "hidden",
        position: "relative",
        borderRadius: "var(--cd-radius-md, 0.375rem) var(--cd-radius-md, 0.375rem) 0 0",
        flexShrink: 0,
        opacity: isPending ? 0.6 : 1,
        transition: "opacity 0.15s ease",
      }}
    >
      {/*
        The inner mock is rendered at 800x600 scaled down to 240x180 (scale 0.3).
        We use data-theme on the container so the CSS variable blocks in globals.css
        apply correctly inside the preview without affecting the rest of the page.
      */}
      <div
        data-theme={themeId}
        style={{
          width: "800px",
          height: "600px",
          transform: "scale(0.3)",
          transformOrigin: "top left",
          pointerEvents: "none",
          userSelect: "none",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {/* Nav bar */}
        <div
          style={{
            height: "56px",
            background: "var(--cd-panel)",
            borderBottom: "1px solid var(--cd-border)",
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              background: "var(--cd-accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--cd-bg)",
              fontFamily: "var(--cd-font-heading)",
              fontWeight: 800,
              fontSize: "12px",
              flexShrink: 0,
              borderRadius: "var(--cd-radius-md)",
            }}
          >
            CD
          </div>
          <span
            style={{
              fontFamily: "var(--cd-font-heading)",
              fontWeight: 700,
              fontSize: "14px",
              color: "var(--cd-accent-primary)",
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            CARTDEX
          </span>
          <div style={{ flex: 1 }} />
          {["SYSTEMS", "GAMES", "FAVORITES"].map((label) => (
            <span
              key={label}
              style={{
                fontFamily: "var(--cd-font-body)",
                fontSize: "12px",
                color: "var(--cd-text-dim)",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Content area with two game cards */}
        <div
          style={{
            background: "var(--cd-bg)",
            padding: "32px 24px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          {[
            { title: "Super Mario World", system: "SNES", status: "have" },
            { title: "Zelda: A Link to the Past", system: "SNES", status: "missing" },
          ].map((game) => (
            <div
              key={game.title}
              style={{
                background: "var(--cd-card)",
                border: `var(--cd-card-border-width, 1px) solid var(--cd-border)`,
                borderRadius: "var(--cd-radius-md)",
                overflow: "hidden",
                boxShadow: "var(--cd-shadow-card)",
              }}
            >
              {/* Cover art placeholder */}
              <div
                style={{
                  height: "120px",
                  background: "var(--cd-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "60px",
                    height: "80px",
                    background: "var(--cd-text-faint)",
                    borderRadius: "var(--cd-radius-sm)",
                    opacity: 0.4,
                  }}
                />
              </div>
              {/* Card info */}
              <div style={{ padding: "10px 12px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--cd-font-body)",
                    fontWeight: 600,
                    color: "var(--cd-text)",
                    marginBottom: "4px",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {game.title}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "9px",
                      fontFamily: "var(--cd-font-mono)",
                      color: "var(--cd-text-dim)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {game.system}
                  </span>
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "var(--cd-radius-full)",
                      background: game.status === "have"
                        ? "var(--cd-accent-success)"
                        : "var(--cd-accent-danger)",
                      flexShrink: 0,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Status bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "44px",
            background: "var(--cd-panel)",
            borderTop: "1px solid var(--cd-border)",
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "var(--cd-radius-full)",
                background: "var(--cd-accent-success)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--cd-font-mono)",
                fontSize: "9px",
                color: "var(--cd-text-dim)",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Archive Online
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
