import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { StatusBar } from "@/components/status-bar";
import { cookies } from "next/headers";
import { DEFAULT_THEME_ID, isValidThemeId } from "@/lib/themes/registry";

export const metadata: Metadata = {
  title: "CartDex",
  description: "Self-hosted ROM library manager",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read theme cookie server-side so the first HTML response already carries
  // the correct data-theme attribute. Zero FOUC — no flash before hydration.
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get("cartdex_theme")?.value ?? "";
  const initialTheme = isValidThemeId(rawCookie) ? rawCookie : DEFAULT_THEME_ID;

  return (
    <html
      lang="en"
      className="h-full"
      data-theme={initialTheme}
      suppressHydrationWarning
    >
      <head>
        {/*
          Inline FOUC guard: reads the cookie synchronously before first paint.
          Handles the narrow window between HTML delivery and React hydration,
          e.g. on a slow connection where CSS loads before the client JS runs.
          The SSR data-theme attribute above handles the common case; this is
          the belt-and-suspenders fallback.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/cartdex_theme=([^;]+)/);if(m&&m[1])document.documentElement.setAttribute('data-theme',m[1]);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider initialTheme={initialTheme}>
          {/* Ambient radial glows — Tatooine motif, hidden via CSS in SNES */}
          <div className="sw-ambient-glow sw-ambient-glow-1" aria-hidden="true" />
          <div className="sw-ambient-glow sw-ambient-glow-2" aria-hidden="true" />

          <Nav />
          <main className="flex-1">
            {children}
          </main>
          <StatusBar />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
