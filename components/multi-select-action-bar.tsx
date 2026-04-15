"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface Props {
  selectedCount: number;
  actions: MultiSelectAction[];
  onClear: () => void;
  /** Label describing what is selected, e.g. "game" → "3 games selected" */
  noun?: string;
}

/**
 * Floating contextual action bar that slides up from the bottom of the viewport
 * when selectedCount > 0. Disappears when selection is cleared.
 *
 * Accessibility:
 * - role="toolbar" with aria-label
 * - First action button receives focus when the bar slides in
 * - Escape key clears selection and dismisses the bar
 * - Focus returns to the triggering element on dismiss
 * - aria-live region announces selection count to screen readers
 */
export function MultiSelectActionBar({
  selectedCount,
  actions,
  onClear,
  noun = "item",
}: Props) {
  const visible = selectedCount > 0;
  const firstActionRef = useRef<HTMLButtonElement>(null);
  // Holds the element that was focused before the bar appeared so we can
  // restore focus when the bar is dismissed (Fix 2).
  const triggerRef = useRef<Element | null>(null);

  // Focus the first action button when bar becomes visible; restore on hide
  useEffect(() => {
    if (visible) {
      triggerRef.current = document.activeElement;
      // Small delay lets the slide-in animation start before focus shifts
      const id = setTimeout(() => firstActionRef.current?.focus(), 80);
      return () => clearTimeout(id);
    } else {
      (triggerRef.current as HTMLElement | null)?.focus();
    }
  }, [visible]);

  // Escape to deselect
  useEffect(() => {
    if (!visible) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClear();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visible, onClear]);

  const label = selectedCount === 1 ? `1 ${noun} selected` : `${selectedCount} ${noun}s selected`;

  return (
    <>
      {/* Fix 3: Persistent live region — announces count changes to screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {visible ? label : ""}
      </div>

      {/* Fix 1 outer wrapper: handles fixed position + centering only, never animated */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
        {/* Fix 1 inner element: animated only, no translate-x conflict */}
        <div
          role="toolbar"
          aria-label={`Bulk actions — ${label}`}
          aria-hidden={!visible}
          className={cn(
            "transition-all duration-200 ease-out pointer-events-auto",
            visible
              ? "translate-y-0 opacity-100"
              : "translate-y-6 opacity-0 pointer-events-none"
          )}
        >
          <div
            className={cn(
              // Glass-style floating panel — works in both light and dark mode
              "flex items-center gap-2 px-4 py-2.5 rounded-xl",
              "bg-background/90 dark:bg-zinc-900/90 backdrop-blur-md",
              "border border-border dark:border-zinc-700",
              "shadow-xl shadow-black/20 dark:shadow-black/50",
              "ring-1 ring-black/5 dark:ring-white/5"
            )}
          >
            {/* Selection count */}
            <span className="text-sm font-medium text-foreground pr-2 border-r border-border dark:border-zinc-700 mr-1 whitespace-nowrap">
              {label}
            </span>

            {/* Action buttons */}
            {actions.map((action, i) => (
              <button
                key={action.label}
                ref={i === 0 ? firstActionRef : undefined}
                onClick={action.onClick}
                tabIndex={visible ? 0 : -1}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
                  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  action.variant === "destructive"
                    ? [
                        "text-red-600 dark:text-red-400",
                        "hover:bg-red-50 dark:hover:bg-red-950/50",
                        "active:bg-red-100 dark:active:bg-red-900/50",
                      ]
                    : [
                        "text-foreground/80",
                        "hover:bg-accent hover:text-foreground",
                        "active:bg-accent/80",
                      ]
                )}
              >
                {action.icon && (
                  <span className="shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">{action.icon}</span>
                )}
                {action.label}
              </button>
            ))}

            {/* Divider + Clear */}
            <div className="ml-1 pl-2 border-l border-border dark:border-zinc-700">
              <button
                onClick={onClear}
                tabIndex={visible ? 0 : -1}
                aria-label="Clear selection"
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-md",
                  "text-muted-foreground hover:text-foreground",
                  "hover:bg-muted dark:hover:bg-zinc-800",
                  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                )}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
