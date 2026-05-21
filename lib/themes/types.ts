export interface ThemeTokens {
  colors: {
    background: string;
    panel: string;
    card: string;
    border: string;
    borderActive: string;
    primary: string;
    primaryDeep: string;
    text: string;
    textDim: string;
    textFaint: string;
    textBright: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    shadow: string;
  };
  fonts: {
    heading: string;
    body: string;
    mono: string;
    accent?: string;
  };
  radius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  shadow: {
    card: string;
    cardHover: string;
    glow: string;
  };
  motifs: {
    divider: "notch" | "rule" | "none";
    statusBarText: string;
    cardBorderWidth: string;
    scanlines: boolean;
    scanlinesOpacity: string;
  };
  googleFonts: string[];
}

export interface ThemePack {
  id: string;
  name: string;
  description: string;
  dark: ThemeTokens;
  light?: ThemeTokens;
}
