import Link from "next/link";
import { ActionButtons } from "@/components/action-buttons";
import { Settings } from "lucide-react";

export function Nav() {
  return (
    <header className="border-b border-neutral-800 px-6 py-4 sticky top-0 z-50 bg-neutral-950/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-bold tracking-tight text-white">
              RomVault
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/">Systems</NavLink>
            <NavLink href="/series">Series</NavLink>
            <NavLink href="/games">All Games</NavLink>
            <NavLink href="/collections">Collections</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ActionButtons />
          <Link
            href="/settings"
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors"
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
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors"
    >
      {children}
    </Link>
  );
}
