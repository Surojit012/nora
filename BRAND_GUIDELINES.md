# Nora Brand Guidelines (v0.1)

## 1) Brand
- Name: `nora`
- Product name (UI): `nora`
- Tagline (optional): `Social, stored on Shelby.`

## 2) Voice
- Tone: calm, technical, minimal
- Style: short labels, no hype
- Error copy: direct + actionable
  - Good: `Upload failed. Check Shelby API key.`
  - Avoid: `Oops! Something went wrong.`

## 3) Color System
All UI colors must come from CSS variables (no hardcoded hex in components).

### Dark (default)
- `--bg`: `#0A0A0A`
- `--surface`: `#111111`
- `--card`: `#161616`
- `--border`: `#222222`
- `--border2`: `#2A2A2A`
- `--text`: `#F0EDE6`
- `--muted`: `#666666`
- `--subtle`: `#333333`
- `--cream` (primary accent): `#E8E6DF`
- `--gold` (highlight): `#C9A96E`
- `--danger`: `#FF4444`
- `--success`: `#3ECF8E`

### Light (secondary)
- `--bg`: `#FAFAFA`
- `--surface`: `#FFFFFF`
- `--card`: `#F4F4F4`
- `--border`: `#E5E5E5`
- `--border2`: `#DEDEDE`
- `--text`: `#111111`
- `--muted`: `#666666`
- `--subtle`: `#AAAAAA`
- `--cream`: `#111111`
- `--gold`: `#C9A96E`
- `--danger`: `#FF4444`
- `--success`: `#3ECF8E`

### Rules
- No gradients, no shadows.
- Gold is rare: active tab, primary affordances, subtle highlights only.
- Borders are the main separators.

## 4) Typography
- Sans: `DM Sans` (app default)
- Mono: `DM Mono` for wallet addresses, timestamps, counts
- Sizes
  - Body: 14px
  - Composer: 15px
  - Widget title: 15px
  - Meta/labels: 11-12px (mono)
- Weights: 400/500 only

## 5) Layout
- App container: max width `1100px`, 3-column grid
  - Left: 240px
  - Center: fluid
  - Right: 300px
- Sticky left + sticky feed header
- Mobile behavior
  - Hide right panel first
  - Hide left panel on small screens (feed-only)

## 6) Components
- Sidebar
  - Logo: SVG mark (shared component), warm accent color
  - Nav item: muted -> text on hover, active = cream + gold icon
  - Primary button: `.post-btn` (cream bg, dark text, pill)
- Feed
  - Sticky header with tabs
  - Composer: textarea + action icons + send button
- Post (Tweet)
  - Border-bottom separator
  - Avatar: 36-40px circle, subtle tinted backgrounds
  - Actions: reply/retweet/like/share
    - Default muted, hover changes color
- Widgets (Right panel)
  - `.widget` cards, title + rows

## 7) Iconography
- Stroke icons, ~1.5px line, 16-18px
- No icon backgrounds
- One consistent icon style set across the app

## 8) Interaction States
- Hover: background shift to `--card` only
- Focus: 1px outline `--gold`, offset 2px
- Disabled: opacity ~0.45, cursor not-allowed

## 9) Data Display Conventions
- Wallet: `0x1234...abcd` (mono)
- Time: relative (`2m`, `1h`) in feed; full timestamp on hover/title
- Counts: `1.2K` format (mono)

