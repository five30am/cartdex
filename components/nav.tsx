"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActionButtons } from "@/components/action-buttons";
import { Settings, Database } from "lucide-react";
import { cn } from "@/lib/utils";

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-white/[0.06] px-6 py-0 sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 h-14">
        {/* Brand + nav links */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shadow-[0_0_12px_rgba(37,99,235,0.4)] group-hover:shadow-[0_0_16px_rgba(37,99,235,0.6)] transition-shadow">
              <Database className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">
              RomVault
            </span>
          </Link>

          <nav className="flex items-center">
            <NavLink href="/" active={pathname === "/"}>Systems</NavLink>
            <NavLink href="/series" active={pathname.startsWith("/series")}>Series</NavLink>
            <NavLink href="/games" active={pathname.startsWith("/games")}>All Games</NavLink>
            <NavLink href="/collections" active={pathname.startsWith("/collections")}>Collections</NavLink>
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <ActionButtons />
          <div className="w-px h-5 bg-white/10" />
          <Link
            href="/settings"
            className={cn(
              "p-1.5 rounded-md transition-colors",
              pathname.startsWith("/settings")
                ? "text-white bg-white/10"
                : "text-neutral-500 hover:text-white hover:bg-white/8"
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
          ? "text-white font-medium"
          : "text-neutral-500 hover:text-neutral-200"
      )}
    >
      {children}
      {active && (
        <span className="absolute bottom-[-1px] left-3 right-3 h-[2px] bg-blue-500 rounded-full" />
      )}
    </Link>
  );
}
