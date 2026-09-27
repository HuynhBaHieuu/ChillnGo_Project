---
version: beta
name: National Park
description: Park at dusk: layered pine greens, cream signage type, one canyon-rust action, coral for live and social.
colors:
  # Greens, darkest to lightest. Each is one elevation step.
  canopy: "#131F16"        # page edges, behind the gradient
  ground: "#18291D"        # page background
  surface: "#1D3123"       # elevated bands: header, composer, live strip
  card: "#223A29"          # content cards
  raised: "#28432F"        # featured cards, active/hover card
  hover: "#2D4A34"         # hover fill for rows and icon buttons
  well: "#15241A"          # inputs and stat tiles, sunk below their card
  # Secondary greens
  sage: "#9DB596"
  moss: "#6E8B5A"
  olive: "#7A7A45"
  forest: "#2F5A3C"
  teal: "#7CC0AC"          # image / photo actions
  # Type
  cream: "#F1E4C6"         # headings, important text
  body: "#DCD2B8"          # running text
  meta: "#B9AE92"          # metadata, captions
  # Warm highlights
  beige: "#E9D8B4"         # inner highlights, borders at low alpha
  ochre: "#C9A46A"         # radial light, small markers
  # Accents
  primary: "#D9803E"       # burnt orange: the one action per screen
  primary-hover: "#E58B49"
  primary-press: "#BF6B2E"
  on-primary: "#15241A"
  social: "#F07C6C"        # coral: live, replay, social activity only
  on-social: "#15241A"
typography:
  display:
    fontFamily: Merriweather
    fontSize: 3rem
    fontWeight: 700
    letterSpacing: "-0.015em"
    lineHeight: 1.05
  h2:
    fontFamily: Merriweather
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.2
  h3:
    fontFamily: Merriweather
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: Lora
    fontSize: 0.9375rem
    lineHeight: 1.65
  meta:
    fontFamily: Lora
    fontSize: 0.8125rem
    lineHeight: 1.45
  label:
    fontFamily: Lora
    fontSize: 0.6875rem
    fontWeight: 600
    letterSpacing: "0.12em"
    textTransform: uppercase
  stat:
    fontFamily: Merriweather
    fontSize: 1.25rem
    fontWeight: 700
    fontVariantNumeric: tabular-nums
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 10px 18px
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.body}"
    rounded: "{rounded.xl}"
    padding: 20px
  card-featured:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.body}"
    rounded: "{rounded.xl}"
    padding: 20px
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.body}"
    rounded: "{rounded.pill}"
---
## Overview

A national park at dusk. The ground is several layers of pine green rather than
one flat colour. Warm light falls from the top of the page, cream text reads
like carved signage, and one burnt-orange action per screen works like a trail
marker. Coral appears only where something is live or social is happening.

The system should feel like a travel journal, not an admin dashboard. It gets
there with layered tone, soft light and serif headlines. Borders and boxes stay
quiet.

The implementation lives in `src/styles/theme.css` (tokens) and
`src/styles/np-surfaces.css` (the surface system). It applies to every public
page through the `.np-page` class on `PageContainer`, `AuthCard` and the live
room. The landing page (`/`) and the admin console keep their own designs.

## Color

### Greens and elevation

Every step up in elevation is one step lighter in green. The steps are small, a
few percent of lightness each, so the page reads as layered rather than striped.

| Level | Token | Hex | Used for |
| --- | --- | --- | --- |
| 0 | `canopy` | `#131F16` | Page edges, under the gradient |
| 1 | `ground` | `#18291D` | Page background |
| 2 | `surface` | `#1D3123` | Header, composer, "Đang live" strip |
| 3 | `card` | `#223A29` | Trip, check-in and replay cards |
| 4 | `raised` | `#28432F` | Featured card (live, replay); card on hover |
| — | `hover` | `#2D4A34` | Hover fill on rows and icon buttons |
| −1 | `well` | `#15241A` | Inputs and stat tiles, sunk into their parent |

`well` is darker than the card it sits in. Inputs and statistics are sunk into
their card, never raised above it.

### Secondary greens

`sage`, `moss`, `olive` and `forest` are for secondary surfaces, tags, icons and
tints. They are never used for text below 14px on `raised` or lighter.

### Type colours

| Token | Hex | On `card` | Use |
| --- | --- | --- | --- |
| `cream` | `#F1E4C6` | 9.8:1 | Headings, names, numbers |
| `body` | `#DCD2B8` | 8.2:1 | Running text |
| `meta` | `#B9AE92` | 5.6:1 | Timestamps, captions, labels (4.9:1 on `raised`) |

Never use pure white (`#FFF`) for text, and never use pure black anywhere.

### Accents

- **Burnt orange `primary` (`#D9803E`)** is the main action: one per screen,
  with `on-primary` (`#15241A`) text at 5.5:1. It only works as a fill. As text
  on `card` it reaches just 4.2:1, so it is used as text only at 18px and above.
- **Coral `social` (`#F07C6C`)** is only for livestream, live status, replays
  and social activity (reactions, "đang xem"). As text it is 4.6:1 on `card`.
  Coral never appears on a trip or check-in card.
- **Teal (`#7CC0AC`)** marks photo and image actions. It is the counterpart to
  coral in the composer.
- **Ochre and beige** are light, not paint. They show up as low-alpha
  highlights, radial glows and the 1px inner top edge of surfaces.

Don't use neon, saturated reds (`rose-600`) or emerald greens from the default
Tailwind palette.

## Depth and atmosphere

### Page background

Three layers, from the bottom up:

1. A vertical linear gradient from `ground` to `canopy`.
2. Two soft radial lights: warm ochre at the top centre, behind the header and
   page title (about 10% alpha), and moss at the upper left (about 12%).
3. A fine grain from an inline SVG `feTurbulence` at about 4% opacity. It needs
   no external asset and breaks up banding in the gradients.

These gradients are the only ones in the system. Components never carry a
decorative gradient, apart from the scrims over photos and the faint top-down
sheen on featured cards described below.

### Borders

Borders are 1px and low-alpha. Each level uses a different tone, so edges read
as light catching a surface rather than as a drawn line:

| Level | Border |
| --- | --- |
| `surface` | `beige` at 7% |
| `card` | `beige` at 9% |
| `raised` / featured | `beige` at 12%, plus the accent glow where one applies |
| `well` | `canopy` at 60%, with a 1px inner shadow at the top |

### Shadows

Shadows are soft and green-black (`rgb(6 14 9)`), never grey. Each surface gets
an inner top highlight: `inset 0 1px 0 beige/6–10%`. That highlight is what
gives the surface its "lit from above" edge.

| Elevation | Shadow |
| --- | --- |
| `surface` | `0 1px 2px rgb(6 14 9 / .35), 0 8px 24px -12px rgb(6 14 9 / .55)` |
| `card` | `0 1px 2px rgb(6 14 9 / .4), 0 14px 32px -18px rgb(6 14 9 / .7)` |
| `raised` / hover | `0 2px 4px rgb(6 14 9 / .4), 0 24px 48px -20px rgb(6 14 9 / .8)` |
| `well` | `inset 0 1px 2px rgb(6 14 9 / .5)` |

### Glow

A glow is an accent-coloured shadow with a large blur and low alpha
(`0 0 0 1px accent/35%, 0 0 24px -4px accent/35%`). It is reserved for live and
replay status, and at most one glow is on screen per card.

## Typography

- **Merriweather** is for page titles, card titles and statistic numbers. Its
  weight is 700 and tracking slightly negative at display size.
- **Lora** is for everything else. Body text is 15px/1.65, metadata 13px/1.45.
- **Labels** (stat names, section eyebrows) are 11px Lora, 600 weight,
  uppercase, with 0.12em tracking, set in `meta`.
- **Numbers** in statistics use Merriweather 700 at 20px with `tabular-nums`,
  set in `cream`. They are the most prominent thing in a stat tile; the label
  sits above and recedes.
- The page title (`display`) is capped at 3rem. Card titles stay at 1.25–1.5rem.
  Nothing on a card is larger than its title.

## Components

### Header

A floating layer, not a full-bleed bar. It is inset 12px from the top and sides
and sized to the page width, with 16px corners, `surface` at 78% alpha and a
12px backdrop blur. The blur is the only glass effect in the system. It carries
the `surface` border and shadow.

- Logo, links and controls are separated by space, not by dividers.
- The active link is `cream` with a 2px `primary` underline 6px below the text.
  Inactive links are `meta`.
- Icon controls (the bell) are 40px `well` circles. The avatar has a 2px ring in
  `beige` at 15% alpha, with 12px between the bell and the avatar.

### Composer

A `surface` card that looks ready to type into.

- The prompt is a pill-shaped `well` input. On hover it lightens one step and
  its border warms to `ochre` at 30%.
- The actions are distinct chips:
  - **Ảnh** has a teal icon on a teal 12% tint.
  - **Livestream** has a coral icon on a coral 12% tint.
  - On hover the tint rises to 20% and the chip lifts 1px. On press it drops
    back and the tint goes to 26%.
- Height stays compact: one row, 44px controls.

### Cards

Cards differ by content type, so the feed does not repeat one box:

| Card | Surface | Distinction |
| --- | --- | --- |
| Trip post | `card` | Cover photo bleeds to the edge. Sage-tinted tags. |
| Check-in | `card` | Accent bar in moss on the left edge. Photos get the rounded frame. |
| Replay | `raised`, featured | Coral glow on the "Xem lại" status. Stats in `well` tiles. |
| Live now | `raised`, featured | Coral glow around the preview. Pulsing LIVE badge. |

- Hierarchy inside a card, top to bottom: media, then meta (13px `meta`), then
  title (Merriweather `cream`), then stats or actions.
- Interactive cards lift 2px on hover and move to `raised`. On press they drop
  back 1px.
- Photos have a 12px radius inside cards (the cover of a trip card bleeds
  instead). Every thumbnail has a 1px `beige` 8% inner border so it does not
  melt into the card.

### Buttons

- **Primary**: `primary` fill with `on-primary` text and an 8px radius. It uses
  the `card` shadow plus an inner top highlight in `beige` at 25%. Hover moves
  the fill to `primary-hover` and lifts it 1px. Press moves it to
  `primary-press` and drops it 1px.
- **Secondary**: `surface` fill, `cream` text, `card` border.
- **Icon button**: a 40px circle, transparent at rest, `hover` fill on hover.

### Overlays

Menus, dialogs, sheets and select lists use `.np-overlay`: a solid `surface`,
the `raised` shadow and a `beige` 10% border. They are never translucent,
because at 90% opacity the page (orange buttons included) showed through.

### Form fields

Inputs and textareas are `well`: sunk into their card with an inner shadow.
On hover the border warms to `ochre` at 25%. On focus it turns `primary` at 60%.

### Tags

Pills with a `sage` 12% fill, `sage` text and a `sage` 20% border. Tags are
never orange or coral.

## States

| State | Surfaces | Accents |
| --- | --- | --- |
| Hover | One elevation step up, lift 1–2px, stronger shadow | Fill moves to `*-hover` |
| Active / press | Back down 1px, shadow tightens | Fill moves to `*-press` |
| Focus | 2px `primary` ring, 2px offset in `ground` | Same |
| Disabled | 50% opacity, no lift | Same |

All movement is transform and shadow only, 150–200ms ease-out. With
`prefers-reduced-motion`, the lift and pulse are dropped and colour changes
stay.

## Livestream

- Coral means live. It appears on the LIVE badge, the live ring on avatars, the
  "Xem lại" status, viewer counts and the play button. It does not appear
  anywhere else on the page.
- **Live badge**: coral fill, `on-social` text, 11px uppercase label, a pulsing
  dot, and a glow (`0 0 16px -2px social/55%`).
- **Replay status**: a coral 14% tint, coral text and a 1px coral 35% border,
  with a soft glow. It is quieter than the live badge, because a replay is not
  urgent.
- **Preview / thumbnail**: a 16:9 frame with a 12px radius. The poster is the
  host photo, blurred, under a dark-green scrim (never grey). The play button
  is a 48px coral circle with a glow. The duration sits in the bottom right on a
  `canopy` 75% pill.
- **Statistics**: `well` tiles. Duration is the lead tile and gets a coral 8%
  tint. The other tiles alternate `well` and `surface` so they read as a set
  without looking like a table. Each tile has a label on top (11px
  uppercase) and a number below (Merriweather 20px `cream`).
- **Responsive**: on phones the preview is full width on top, and the stats
  sit in a 2- or 3-column grid below it. From `sm` up, the preview sits
  on the left at 14–16rem wide and the stats fill the right.

## Do's and Don'ts

- **Do** build depth from tone steps, soft light and inner highlights before
  reaching for borders.
- **Do** give each content type its own surface treatment.
- **Do** keep burnt orange to one action per screen and coral to live/social.
- **Don't** put the same border, shadow and background on every card.
- **Don't** use pure white, pure black, neon, or Tailwind's default `rose` and
  `emerald` shades.
- **Don't** add decorative gradients to components. The page background and
  photo scrims are the only gradients.
- **Don't** stack glass effects. Only the header blurs.
