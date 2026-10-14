netlend.finance is a lending protocol. People supply stablecoins to earn a variable rate and borrow against collateral such as tokenized stocks and real-world assets. The brand is minimal, trustworthy, modern, sleek, calm and infrastructure-first. It should feel like a well-run bank's back office rebuilt for open finance, never like a casino.

Three further sections sit beside this one. **Build guide for Claude Code** turns this system into a working site. **Social posts** covers post templates and copy. **X profile** covers the header, avatar and bio.

## Voice and content

- Write the name as `netlend.finance` in all lowercase, including at the start of a sentence. In running text after first use, "netlend" is fine. Never "NetLend" or "Netlend Finance".
- Sentence case for headings, buttons and labels ("Connect wallet", "Your positions"). The only capitals block is the `eyebrow` style.
- Plain and specific. Say what happens and what it costs. "Supply USDX and earn a variable rate" rather than "Unlock the power of yield".
- Address the reader as "you". Speak as "we" only in announcements.
- No hype words (revolutionary, moon, degen, 100x), no exclamation marks, no emoji in product or posts.
- Rates are always "variable" unless they are fixed. Never promise returns. Every figure shown publicly is real, dated and sourced.
- Error and disabled copy states the reason and the fix ("Insufficient balance", "Health factor too low, add collateral or repay").

Real copy from the brand map: "Modern infrastructure for a more open financial future." "Real-time data, clearer decisions." "Clean typography for a more open financial future."

## Colour

The palette is six nature-inspired tones from the brand map. Build UI with the semantic tokens so the dark theme works; reach for the palette tokens directly only in brand graphics.

| Role | Light | Use |
|---|---|---|
| `bg` | `soft-stone` #F3F0EA | Page canvas |
| `surface` | #FCFBF8 | Cards, panels, inputs, tables |
| `surface-muted` | #E6E8E3 | Table headers, tab tracks, skeletons |
| `border` | `mist-grey` #D9DDD8 | Hairlines only |
| `ink` | `carbon` #161A18 | Text and figures |
| `ink-muted` | #535C57 | Secondary text |
| `primary` | `deep-moss` #243A33 | Main actions, with `on-primary` text |
| `accent` | `shadow-sage` #5E746A | Icons and chart lines |

- Keep contrast restrained but readable. Every text token holds 4.5:1 on `bg`, `surface` and `surface-muted` in both themes. `shadow-sage` is 4.4:1 on `soft-stone`, so use it for icons, lines and type at 24px or larger, never body text.
- Status colours (`positive`, `warning`, `negative`) are muted and always come with a word. A position is "Healthy", "Caution" or "At risk", never just green, amber or red.
- Do: use restrained contrast, keep layouts airy, use muted green-charcoal tones, prioritise clarity and readability, maintain a premium minimal feel.
- Don't: bright blue, purple, noisy gradients, clutter, overly decorative elements, low-contrast text.
- The dark theme lifts `primary` to a pale sage (#A9C2B5) with `on-primary` set to `carbon`. Never put white text on it.

## Typography

- Headings in **Manrope** (`display` family), bold or semibold, with slightly tight tracking. Body and UI in **Inter** (`sans` family), regular and medium. Both ship as variable woff2 files in `fonts/`.
- Use `display-xl` once per marketing page for the hero, `heading-1` for app page titles, `heading-2` for sections, `heading-3` for card titles.
- `body` (15/24) is the default. `body-sm` for helper text and secondary table lines. `label` for buttons, tabs and nav.
- Set every number with tabular figures (`font-variant-numeric: tabular-nums`, or the `nl-num` class). Big numbers use `figure-lg`, table numbers `figure`.
- `eyebrow` (12px, 0.18em tracking, uppercase) introduces a section, as in the brand map's "MODERN INFRASTRUCTURE FOR A MORE OPEN FINANCIAL FUTURE".
- Lowercase-friendly. The wordmark and the name stay lowercase.

## Layout and spacing

- The container is `content-max` (1200px) with `space-7` (48px) gutters on desktop and `space-4` (16px) on mobile.
- Spacing runs on a 4px base, `space-1` to `space-8`. Card padding is `space-5` (24px). Marketing sections are `space-8` (96px) apart. Whitespace is part of the brand, so when in doubt add space rather than a divider.
- The app uses a 12-column grid. The market detail view is 8 columns of facts and charts beside a 4-column ActionPanel (`panel-width`, 400px).
- Breakpoints at 720px (tables become cards) and 960px (two-column layouts stack).

## Shape, borders and depth

- Radii are `radius-sm` (8px), `radius-md` (12px), `radius-lg` (16px) and `radius-pill`. Buttons, chips and tabs are pills; inputs are `radius-md`; cards and panels are `radius-lg`.
- Separate surfaces with a 1px `border` hairline first and `shadow-card` second. Shadows are soft and short, never coloured.
- Controls that people type into or click carry `border-control` (3:1 or better), not the decorative `border`.
- Keyboard focus is a 2px solid `focus-ring` outline with a 2px offset on every interactive element. Never remove it.

## Iconography

- Use **Lucide** icons (MIT licensed) at 1.5px stroke, 20px in cards and 16px in buttons, coloured `accent` or `currentColor`. The brand map's icons (leaf, shield, bars, bolt, lotus, layers) are in that outline style.
- Inside cards, put the icon in a 40px `surface-muted` tile with `radius-sm`.
- No emoji, no filled or duotone icon sets, no 3D illustrations.
- Token logos in the app come from each asset's issuer. Until you have them, show a 24px `surface-muted` circle with the first two letters of the symbol.

## Logo

- Files live in the Logos asset group. `netlend-logo.png` is the primary lockup (icon plus wordmark), `netlend-icon.png` the N mark for favicons and avatars, `netlend-wordmark.png` the text-only lockup. All have transparent backgrounds and full-colour green ink.
- Place the full-colour logo on `soft-stone`, `surface` or white. On `deep-moss` or any dark ground (including the dark theme header) use `netlend-logo-reverse.png`, the icon inside a `soft-stone` rounded tile beside a `soft-stone` wordmark. `netlend-wordmark-reverse.png` is the wordmark alone for dark grounds.
- Clear space around the lockup equals half the icon's height. Minimum size is 20px tall for the lockup and 16px for the icon.
- Do not recolour, outline, rotate, stretch, add effects or rebuild the mark. The current files are raster exports of the source artwork, so ask a designer for a vector (SVG) master before print or very large use.

## Motion and states

- Transitions are 150ms ease on colour and background only. No bounce, no parallax, no auto-playing animation.
- Hover darkens fills to `primary-hover` or adds `surface-muted`. Disabled controls use `surface-muted` with `ink-muted` text and a label that says why.
- Loading shows `surface-muted` skeleton bars at the size of the expected content. Never fill a figure with a made-up number while data loads.
- Transaction progress uses StatusChip words (Pending, Confirmed, Failed) and links to the block explorer.

## Data display

- Money above $100K in compact form ($12.4M), below that in full with two decimals. Token amounts to the token's display precision, max six decimals.
- Percentages to two decimals with a % sign. APYs are labelled Supply APY or Borrow APY and described as variable.
- Health factor to two decimals with the word. Default bands are Healthy 1.50 and up, Caution 1.10 to 1.49, At risk below 1.10.
- Addresses are truncated to 0x12ab...89cd with a copy button.
