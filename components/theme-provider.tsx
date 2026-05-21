"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME_ID, type ThemeId } from "@/lib/themes/registry";
import { mutationHeaders } from "@/lib/api-token";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (id: ThemeId) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME_ID as ThemeId,
  setTheme: async () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: string;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const resolved = (initialTheme ?? DEFAULT_THEME_ID) as ThemeId;
  const [theme, setThemeState] = useState<ThemeId>(resolved);

  // Sync data-theme attribute on the html element whenever theme changes.
  // The SSR pass already sets it via the layout; this keeps it in sync after
  // client-side switches without a full page reload.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  async function setTheme(id: ThemeId) {
    const previous = theme;
    // Optimistic apply
    setThemeState(id);
    document.documentElement.setAttribute("data-theme", id);

    try {
      const headers = await mutationHeaders();
      const res = await fetch("/api/preferences/theme", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ theme: id }),
      });
      if (!res.ok) throw new Error("PUT failed");
    } catch {
      // Revert on failure
      setThemeState(previous);
      document.documentElement.setAttribute("data-theme", previous);
      throw new Error("Could not save theme preference. Check your settings.");
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
