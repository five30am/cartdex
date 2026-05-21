# CartDex UI Reskin — Star Wars / Earth Tone Theme

Reskin the existing CartDex web frontend to match the design reference file at `romvault_starwars.html` (attached/in project root). This is a complete visual overhaul — the app's functionality, routing, and data layer stay the same. Only the CSS/styling, fonts, and minor structural HTML changes are needed.

## Design Direction

"Jedi Archives meets bounty hunter terminal" — a dark, warm, cinematic UI with desert earth tones, galactic-tech typography, and subtle atmospheric effects. Think Tatooine cantina crossed with a Jedi Temple data terminal.

## Fonts (Google Fonts)

Load these three from Google Fonts:
- **Orbitron** (weights: 400–900) — used for: logo text, system/page titles, badges, filter section headers, placeholder text in game cards
- **Rajdhani** (weights: 300–700) — used for: body/default font, nav links, game titles, filter item names, filter section titles, search input
- **Share Tech Mono** — used for: all monospace/data readout text — breadcrumbs, metadata counts, year labels, status bar, nav buttons, sort select, filter counts, decorative text

## Color Palette (CSS Variables)

```css
:root {
  --sand: #c4a46c;
  --sand-light: #d4bb8a;
  --sand-dim: #8a7450;
  --ochre: #b5651d;
  --ochre-glow: #d4862a;
  --rust: #6b3a2a;
  --deep-brown: #1a120b;
  --dark-bg: #0d0a07;
  --panel-bg: #151009;
  --panel-border: #2a1f14;
  --card-bg: #1a1208;
  --card-hover: #221a0f;
  --text-primary: #d4c4a0;
  --text-dim: #7a6b52;
  --text-bright: #e8dcc4;
  --accent-blue: #4a7a9b;
  --accent-blue-dim: #2a4a5b;
  --danger: #8b3a3a;
  --success: #4a6b3a;
  --glow-sand: 0 0 20px rgba(196, 164, 108, 0.15);
  --glow-ochre: 0 0 12px rgba(181, 101, 29, 0.2);
}
```

## Key Design Rules

### Backgrounds & Atmosphere
- Body background: `var(--dark-bg)` (#0d0a07) — a very dark warm brown, NOT pure black
- Top nav: subtle gradient `linear-gradient(180deg, #18120a 0%, #0d0a07 100%)`
- System header area: `linear-gradient(180deg, rgba(26, 18, 8, 0.5) 0%, transparent 100%)`
- Filter sidebar: `linear-gradient(270deg, rgba(13, 10, 7, 0.5) 0%, transparent 100%)`
- Add a **subtle scanline overlay** on `body::after` — repeating-linear-gradient with 2px transparent / 2px rgba(0,0,0,0.03) stripes, fixed position, pointer-events:none, z-index:9999
- Add two **ambient radial glows** — fixed position, pointer-events:none, z-index:-1:
  - Top-right: `radial-gradient(circle, rgba(181, 101, 29, 0.04) 0%, transparent 70%)` — 600x600px
  - Bottom-left: `radial-gradient(circle, rgba(74, 122, 155, 0.03) 0%, transparent 70%)` — 500x500px

### Borders
- All borders use `var(--panel-border)` (#2a1f14) — a warm dark brown, 1px solid
- No bright or white borders anywhere

### Typography Sizes (these are the final sizes, do not shrink)
- Logo text: 18px Orbitron 700
- Nav links: 15px Rajdhani 500, uppercase, letter-spacing 1.5px
- Nav buttons (Scan ROMs, Scrape Metadata): 13px Share Tech Mono, uppercase
- Breadcrumb: 13px Share Tech Mono, uppercase, letter-spacing 2px
- System badge (e.g. "SNES"): 13px Orbitron 700, letter-spacing 2px
- System name (e.g. "Super Nintendo"): 32px Orbitron 600, letter-spacing 2px
- System meta (game count line): 15px Share Tech Mono
- Search input: 16px Rajdhani 500
- Sort dropdown: 14px Share Tech Mono
- Game card title: 15px Rajdhani 600
- Game card year: 13px Share Tech Mono
- Filter sidebar title ("FILTERS"): 14px Orbitron 600, letter-spacing 3px, uppercase
- Filter count: 14px Share Tech Mono
- Filter section titles (Genre, Year, etc): 16px Rajdhani 600, uppercase
- Filter item names: 15px Rajdhani 500
- Filter item counts: 13px Share Tech Mono
- Status bar items: 12px Share Tech Mono, uppercase, letter-spacing 1px

### Interactive States
- Nav links: hover/active get `color: var(--sand-light)` with `background: rgba(196, 164, 108, 0.08)`
- Buttons: hover gets `border-color: var(--sand-dim)`, `color: var(--sand)`, subtle background tint
- Game cards: hover gets `transform: translateY(-4px)`, border changes to `var(--sand-dim)`, `box-shadow: var(--glow-sand)`
- Game card hover effect: a **hologram scan line** — a pseudo-element `::after` on the thumbnail that animates a semi-transparent gradient band vertically (translateY -100% to 100%) over 1.5s linear infinite
- Filter items: hover gets left border `var(--sand-dim)` + subtle background; active state gets left border `var(--ochre)` + stronger background
- Links (like "78 hidden"): use `var(--accent-blue)` with underline on hover

### System Badge
- The system badge (SNES, NES, etc) uses a gradient background: `linear-gradient(135deg, var(--sand) 0%, var(--ochre) 100%)`
- Text color is `var(--dark-bg)` (dark on light badge)
- Has `box-shadow: var(--glow-sand)` for a soft sand glow

### Game Grid
- Grid: `repeat(auto-fill, minmax(155px, 1fr))` with 20px gap
- Card thumbnails: `aspect-ratio: 0.72`, border-radius 6px, 1px solid panel-border
- Staggered fade-in animation: each card gets `animation: fadeInUp 0.4s ease both` with incrementing `animation-delay` (0.02s per card)

### Status Bar (bottom HUD)
- Fixed to bottom, 32px tall, `var(--panel-bg)` background, 1px top border
- Contains status items in Share Tech Mono 12px uppercase
- First item has a green dot (6px circle, `var(--success)` with green glow shadow) + "ARCHIVE ONLINE"
- Other items: system info, last scan timestamp, version number
- This is purely decorative/atmospheric — it doesn't need to be functional

### Scrollbar
- 6px wide webkit scrollbar
- Track: `var(--dark-bg)`
- Thumb: `var(--panel-border)`, border-radius 3px, hover `var(--sand-dim)`

### Decorative Details
- A small monospace text element in the filter sidebar footer: `// archive.holocron.v4.2` in 11px Share Tech Mono, `var(--panel-border)` color, letter-spacing 4px — purely atmospheric

## What NOT to Change
- Don't modify routing, state management, data fetching, or business logic
- Don't change the component structure/hierarchy unless needed to add the atmospheric elements (scanlines, ambient glows, status bar)
- Keep all existing functionality — search, filtering, sorting, grid/list toggle, etc.
- The existing app likely uses a component framework (React, Vue, Svelte, etc) — work within that framework, don't rewrite to vanilla HTML

## Approach
1. First, explore the project structure and identify where styles/themes are defined
2. Update or replace the CSS variables / theme tokens with the palette above
3. Swap in the Google Fonts (Orbitron, Rajdhani, Share Tech Mono)
4. Update component styles to match the reference — work through each section: nav, system header, toolbar, game grid, filter sidebar
5. Add the atmospheric elements: scanline overlay, ambient glows, status bar, hologram hover effect
6. Test that all existing functionality still works after the reskin
