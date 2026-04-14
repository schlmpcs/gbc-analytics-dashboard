# Design System Specification: The Analytical Architect

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Curator"**

In the world of high-stakes retail analytics, data is often cluttered and overwhelming. This design system rejects the "dashboard-as-a-cockpit" cliché in favor of a "Digital Curator" approach. We treat data with editorial reverence, using expansive whitespace, intentional asymmetry, and a sophisticated layering system that guides the eye toward insight rather than noise.

To break the "template" look, we move away from rigid, boxed-in grids. We use a **Layered Depth Model** where content is organized on "floating planes." By utilizing varying tonal shifts and blurred glass effects, we create a sense of hierarchy that feels organic and premium. The goal is an interface that doesn't just display numbers, but narrates a retail story with authority and calm.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
The palette is rooted in deep, authoritative blues (`#00288e`, `#003853`) and sophisticated neutrals. 

### The "No-Line" Rule
Explicitly prohibited: 1px solid borders for sectioning or containers. 
Boundaries must be defined solely through:
- **Background Color Shifts:** Use `surface-container-low` for a sidebar sitting on a `background` canvas.
- **Tonal Transitions:** Use a slightly higher tier (e.g., `surface-container-highest`) to distinguish a header from a body without a "line."

### Surface Hierarchy & Nesting
Treat the UI as physical layers of fine paper or frosted glass.
- **Canvas:** `background` (#f8f9ff)
- **Primary Layout Sections:** `surface-container-low` (#eff4ff)
- **Functional Cards/Containers:** `surface-container-lowest` (#ffffff)
- **Interactive/Raised Elements:** `surface-container-high` (#dde9ff)

### The Glass & Gradient Rule
To achieve "The Digital Curator" aesthetic, main action areas or hero KPI backgrounds should use a subtle linear gradient from `primary` (#00288e) to `primary-container` (#1e40af). For the Detail Side-Drawer, employ **Glassmorphism**: use `surface` at 80% opacity with a `20px` backdrop-blur to allow the dashboard data to softly bleed through, maintaining context.

---

## 3. Typography: Editorial Authority
We utilize **Inter** across all scales to ensure maximum legibility, but we play with extreme scale contrast to create an editorial feel.

- **The Power Headline:** Use `display-md` (2.75rem) for primary dashboard stats. This isn't just a number; it’s a statement.
- **The Information Subtitle:** Pair high-level headings (`headline-sm`) with `label-md` in `on-surface-variant` for metadata.
- **Hierarchy through Weight:** Use `title-lg` for card headers, but keep the tracking (letter-spacing) tight to maintain a modern, "compact" premium look.
- **Readable Data:** All table content and body text must use `body-md` (0.875rem) to ensure high-density retail data remains scannable.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are often a crutch for poor layout. This system prioritizes **Tonal Layering**.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. The subtle shift from `#ffffff` to `#eff4ff` creates a soft, natural lift that is easier on the eyes than a shadow.
- **Ambient Shadows:** If a "floating" element (like a detail drawer or dropdown) requires a shadow, it must be an **Ambient Glow**: `0px 12px 32px rgba(13, 28, 47, 0.06)`. The shadow color is a low-opacity version of `on-surface` (#0d1c2f), mimicking natural light.
- **The "Ghost Border" Fallback:** If accessibility requires a container boundary, use a **Ghost Border**: `outline-variant` (#c4c5d5) at **15% opacity**. Never use 100% opaque borders.

---

## 5. Components

### KPI Cards
- **Structure:** No borders. Use `surface-container-lowest` background with a `xl` (0.75rem) corner radius.
- **Content:** The metric uses `display-sm` in `primary`. Status indicators (e.g., "Complete") use a `secondary-container` chip with `on-secondary-container` text.
- **Visual Soul:** Add a faint, 10% opacity `surface-tint` gradient in the corner of the card to draw the eye.

### Data Tables
- **Gridless Design:** Forbid the use of vertical or horizontal divider lines. 
- **Separation:** Use a `surface-container-low` background on the table header. Use `16px` of vertical white space between rows. On hover, transition the row background to `surface-container-highest`.

### The Detail Drawer
- **Style:** Anchored to the right. Use the **Glassmorphism** rule (80% opacity `surface` + backdrop blur).
- **Interaction:** Slide-in motion should be a custom cubic-bezier (0.2, 0.8, 0.2, 1) for a "weighted," high-end feel.

### Status Chips
- **New:** `on-tertiary-container` text on `tertiary-container`.
- **In-Progress:** Custom orange (Brand Accent) with 10% opacity background of the same color.
- **Complete:** `on-primary-container` text on `primary-fixed`.
- **Cancelled:** `on-error-container` text on `error_container`.

### Buttons
- **Primary:** Gradient fill (`primary` to `primary-container`), white text, `md` (0.375rem) radius.
- **Secondary:** Transparent background with a "Ghost Border" (15% `outline`).
- **Tertiary:** Text only, using `primary-fixed-variant` for a subtle, high-end link style.

---

## 6. Do’s and Don’ts

### Do:
- **Do** use whitespace as a functional tool to group related retail metrics.
- **Do** use `surface-dim` for "empty state" backgrounds to maintain the moody, professional aesthetic.
- **Do** use `full` (9999px) roundedness for status chips, but stick to `xl` (0.75rem) for functional cards.

### Don’t:
- **Don’t** use pure black (#000000) for text. Always use `on-surface` (#0d1c2f) to keep the palette sophisticated and "ink-like."
- **Don’t** use standard 1px borders. If you feel you need one, try a background color shift first.
- **Don’t** crowd the charts. Every chart should have at least `32px` of "breathing room" (padding) from its container edges.