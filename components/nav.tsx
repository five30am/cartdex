"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActionButtons } from "@/components/action-buttons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Settings, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

export function Nav() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50 border-b px-6"
      style={{
        background: "linear-gradient(180deg, #18120a 0%, #0d0a07 100%)",
        borderBottomColor: "var(--panel-border)",
      }}
    >
      <div className="flex items-center justify-between gap-6 h-14">
        {/* Brand + nav links */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--ochre) 0%, var(--sand-dim) 100%)",
                boxShadow: "var(--glow-ochre)",
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 800,
                fontSize: "0.875rem",
                color: "var(--dark-bg)",
              }}
            >
              CD
            </div>
            <span
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 700,
                fontSize: "1.125rem",
                letterSpacing: "3px",
                color: "var(--sand)",
                textTransform: "uppercase",
              }}
            >
              CartDex
            </span>
          </Link>

          <nav className="flex items-center">
            <NavLink href="/" active={pathname === "/"}>Systems</NavLink>
            <NavLink href="/games" active={pathname.startsWith("/games")}>All Games</NavLink>
            <NavLink href="/favorites" active={pathname.startsWith("/favorites")}>
              ♦ Favorites
            </NavLink>
            <NavLink href="/publishers" active={pathname.startsWith("/publishers")}>Publishers</NavLink>
            <NavLink href="/series" active={pathname.startsWith("/series")}>Series</NavLink>
            <NavLink href="/collections" active={pathname.startsWith("/collections")}>Collections</NavLink>
            <NavLink href="/duplicates" active={pathname.startsWith("/duplicates")}>Duplicates</NavLink>
            <NavLink href="/trash" active={pathname.startsWith("/trash")}>Trash</NavLink>
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ActionButtons />
          <div className="w-px h-5" style={{ background: "var(--panel-border)" }} />
          <ThemeToggle />
          <div className="w-px h-5" style={{ background: "var(--panel-border)" }} />
          <Link
            href="/audit"
            className={cn(
              "p-1.5 rounded-md transition-colors",
              pathname.startsWith("/audit")
                ? "text-foreground bg-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            title="Audit Log"
          >
            <ClipboardList className="w-4 h-4" />
          </Link>
          <Link
            href="/settings"
            className={cn(
              "p-1.5 rounded-md transition-colors",
              pathname.startsWith("/settings")
                ? "text-foreground bg-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md transition-all duration-200"
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 500,
        fontSize: "0.9375rem",
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color: active ? "var(--sand-light)" : "var(--text-dim)",
        background: active ? "rgba(196, 164, 108, 0.08)" : "transparent",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
