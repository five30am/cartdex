import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { StatusBar } from "@/components/status-bar";

export const metadata: Metadata = {
  title: "CartDex",
  description: "Self-hosted ROM library manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full dark"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          forcedTheme="dark"
        >
          {/* Ambient radial glows */}
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
