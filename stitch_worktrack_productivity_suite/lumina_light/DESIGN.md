---
name: Lumina Light
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3d4947'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#4b41e1'
  on-secondary: '#ffffff'
  secondary-container: '#645efb'
  on-secondary-container: '#fffbff'
  tertiary: '#595c5e'
  on-tertiary: '#ffffff'
  tertiary-container: '#727577'
  on-tertiary-container: '#fbfdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 24px
  gutter: 16px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style

The design system evolves into a luminous, airy, and high-clarity aesthetic. It targets professional environments where focus and transparency are paramount. The brand personality is serene yet technically precise, evoking a sense of openness and modern sophistication.

The design style is **Light Glassmorphism**. This approach leverages multi-layered translucency, soft refractive edges, and deep backdrop blurs to create a spatial UI that feels lightweight and ethereal. Unlike its dark predecessor, this version focuses on high-key brightness and subtle tonal shifts to define hierarchy, ensuring the interface feels energized and expansive.

## Colors

The palette transitions from deep space to high-altitude clarity. 

- **Primary (Teal):** Adjusted to a slightly deeper tone to maintain AAA accessibility against light glass surfaces.
- **Secondary (Indigo):** Shifted toward a more vibrant, electric hue to serve as a clear call-to-action against pale backgrounds.
- **Background:** A soft, ambient gradient typically moving from top-left (#FFFFFF) to bottom-right (#F1F5F9).
- **Surface:** High-transparency whites (70-80% opacity) with heavy backdrop blurs (20px-40px).
- **Text:** Deep slate for primary information, ensuring crisp legibility through the glass layers.

## Typography

Typography in this design system balances the approachability of **Plus Jakarta Sans** for headings with the systematic efficiency of **Inter** for long-form content. 

- Use **Plus Jakarta Sans** for all major interface headers to lean into the "friendly professional" persona.
- Use **Inter** for all body text, ensuring high legibility even when placed over translucent glass containers.
- Use **JetBrains Mono** sparingly for metadata, labels, and technical values to provide a subtle "developer-tool" precision to the otherwise soft aesthetic.

## Layout & Spacing

The layout utilizes a **fluid grid** system to maximize the airy feel of the design system. 

- **Desktop:** 12-column grid with 24px gutters.
- **Tablet:** 8-column grid with 20px gutters.
- **Mobile:** 4-column grid with 16px gutters.

Spacing follows an 8px rhythmic scale. Because of the glassmorphic nature of the components, inner padding of cards and containers should be generous (minimum 24px) to ensure content does not feel cramped against the refractive edges of the glass containers.

## Elevation & Depth

Depth is communicated through **refraction and diffusion** rather than traditional shadow stacking.

1.  **Base Layer:** Soft mesh gradient (White to Slate-100).
2.  **Surface Layer (Glass):** Background blur (24px), background color (White @ 70% opacity), and a 1px inner border (White @ 40% opacity) to simulate a light-catching edge.
3.  **Raised Layer:** Used for active modals or menus. Increased background blur (40px) and a very soft, large-radius ambient shadow (Color: Slate-900, Opacity: 4%, Blur: 30px).
4.  **Interactive States:** On hover, glass surfaces should increase in opacity from 70% to 90% to provide immediate tactile feedback.

## Shapes

The design system uses **Rounded** geometry. 

- Standard components (Buttons, Inputs) use a 0.5rem (8px) radius.
- Large containers and Glass cards use 1rem (16px) or 1.5rem (24px) radii to emphasize the liquid-like nature of the glass.
- High-rounding is essential for the glassmorphic effect to feel organic and modern; sharp corners should be avoided as they break the illusion of a smooth, physical refractive material.

## Components

### Buttons
- **Primary:** Solid Teal (#0D9488) with white text. No transparency.
- **Secondary:** Glass-style (White @ 40%) with a 1px border of Indigo (#4F46E5) and Indigo text.
- **Ghost:** No background; Teal text; Teal icon.

### Inputs
- Background: White @ 50% opacity.
- Border: 1px Slate-200.
- Focus State: 1px Indigo border with a subtle Indigo outer glow (blur: 4px).

### Cards (Glass Panels)
- Background: `rgba(255, 255, 255, 0.7)`.
- Backdrop-filter: `blur(20px)`.
- Border: 1px solid `rgba(255, 255, 255, 0.5)`.
- Shadows: Use the ambient shadow defined in the Elevation section for a floating effect.

### Chips & Tags
- Pill-shaped (rounded-xl).
- Background: Subtle tint of the category color (e.g., Teal @ 10% opacity) with a solid text color of the same hue.

### Lists
- Separated by thin, high-transparency lines (`rgba(15, 23, 42, 0.05)`).
- Hover state: Background changes to `rgba(255, 255, 255, 0.4)`.