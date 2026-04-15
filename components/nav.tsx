"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActionButtons } from "@/components/action-buttons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Settings, Database, ClipboardList, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border px-6 py-0 sticky top-0 z-50 bg-background/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 h-14">
        {/* Brand + nav links */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shadow-[0_0_12px_rgba(37,99,235,0.4)] group-hover:shadow-[0_0_16px_rgba(37,99,235,0.6)] transition-shadow">
              <Database className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              RomVault
            </span>
          </Link>

          <nav className="flex items-center">
            <NavLink href="/" active={pathname === "/"}>Systems</NavLink>
            <NavLink href="/games" active={pathname.startsWith("/games")}>All Games</NavLink>
            <NavLink href="/favorites" active={pathname.startsWith("/favorites")}>
              <span className="flex items-center gap-1">
                <Heart className={cn("w-3 h-3", pathname.startsWith("/favorites") ? "fill-pink-400 text-pink-400" : "")} />
                Favorites
              </span>
            </NavLink>
            <NavLink href="/publishers" active={pathname.startsWith("/publishers")}>Publishers</NavLink>
            <NavLink href="/series" active={pathname.startsWith("/series")}>Series</NavLink>
            <NavLink href="/collections" active={pathname.startsWith("/collections")}>Collections</NavLink>
            <NavLink href="/duplicates" active={pathname.startsWith("/duplicates")}>Duplicates</NavLink>
            <NavLink href="/trash" active={pathname.startsWith("/trash")}>Trash</NavLink>
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <ActionButtons />
          <div className="w-px h-5 bg-border" />
          <ThemeToggle />
          <div className="w-px h-5 bg-border" />
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
      className={cn(
        "px-3 py-1 text-sm rounded-md transition-colors relative",
        active
          ? "text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
      {active && (
        <span className="absolute bottom-[-1px] left-3 right-3 h-[2px] bg-blue-500 rounded-full" />
      )}
    </Link>
  );
}
