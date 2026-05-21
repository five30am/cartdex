"use client";

import { useTheme } from "@/components/theme-provider";
import { getTheme } from "@/lib/themes/registry";

export function StatusBar() {
  const { theme } = useTheme();
  const pack = getTheme(theme);
  const statusText = pack.dark.motifs.statusBarText;

  return (
    <div className="sw-status-bar cd-status-bar" aria-hidden="true">
      <div className="sw-status-item cd-status-item">
        <span className="sw-status-dot cd-status-dot" />
        Archive Online
      </div>
      <div className="sw-status-item cd-status-item">{statusText}</div>
      <div className="sw-status-item cd-status-item">CartDex v4.2.0</div>
      <div style={{ flex: 1 }} />
      <div className="sw-status-item cd-status-item">// archive.local.v4.2</div>
    </div>
  );
}
