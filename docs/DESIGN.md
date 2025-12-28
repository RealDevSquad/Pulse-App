# Pulse App - Dashboard Design

---

## Refactoring UI Package Reference

The `Refactoring-UI-Package/` folder contains design resources from [Refactoring UI](https://www.refactoringui.com/).

### PDF Documents
| File | Description |
|------|-------------|
| `Refactoring UI v1.0.2.pdf` | Main book - comprehensive UI design principles |
| `Color Palettes v1.1.0.pdf` | Color palette guide and theory |
| `Component Gallery v1.1.0.pdf` | Ready-to-use component examples |
| `Font Recommendations v1.0.1.pdf` | Typography recommendations and font pairings |

### Video Tutorials
| File | Description |
|------|-------------|
| `Designing a Dashboard.mp4` | Tutorial on dashboard design patterns |
| `Designing a Complex Form.mp4` | Tutorial on form design best practices |
| `Designing Content v1.0.1.mp4` | Tutorial on content layout and hierarchy |

### Color Palettes (JSON)
Located in `Color Palettes JSON v1.1.0/`:
- 24 pre-built color palettes (`palette-01.json` to `palette-24.json`)
- `swatches.json` - Master swatch collection

### Icons
Located in `Icons v1.0.2/`:
- `icons/` - 200 SVG icons
- `icons.sketch` - Sketch source file
- `demo.html` - Icon preview page
- `samples/` - Sample icon usage

---

## Refactoring UI Principles

These principles from [Refactoring UI](https://www.refactoringui.com/) guide our design decisions.

### 1. Hierarchy Through Color & Weight, Not Size

```
❌ BAD: Using only size for hierarchy
┌─────────────────────────────────────┐
│  HUGE TITLE (24px)                  │
│  medium text (14px)                 │
│  tiny text (10px)                   │  <- Hard to read!
└─────────────────────────────────────┘

✅ GOOD: Using weight + color for hierarchy
┌─────────────────────────────────────┐
│  Title (16px, font-semibold, dark)  │
│  Body (14px, font-normal, gray-600) │
│  Meta (14px, font-normal, gray-400) │  <- Same size, still readable!
└─────────────────────────────────────┘
```

**Key rules:**
- Primary content: Dark color (gray-900), font-semibold (600-700)
- Secondary content: Medium gray (gray-600), font-normal (400-500)
- Tertiary content: Light gray (gray-400), font-normal
- **Never use font-weight under 400** - too hard to read at small sizes

### 2. Minimum Font Sizes

```
┌─────────────────────────────────────┐
│                                     │
│  Mobile minimum: 14px (text-sm)     │
│  Desktop minimum: 12px (text-xs)    │
│                                     │
│  ❌ Avoid: 10px, 11px on mobile     │
│  ✅ Use: 14px+ with color hierarchy │
│                                     │
└─────────────────────────────────────┘
```

### 3. De-emphasize with Color, Not Size

```
❌ BAD                          ✅ GOOD
┌────────────────────┐         ┌────────────────────┐
│ Task Title         │         │ Task Title         │
│ tiny gray text     │  ->     │ Same size, lighter │
│ (10px)             │         │ color (gray-400)   │
└────────────────────┘         └────────────────────┘
```

### 4. Spacing Creates Separation (Not Borders)

```
❌ TOO MANY BORDERS             ✅ USE SPACING + SHADOWS
┌─────────────────────┐        ┌─────────────────────┐
│ ┌─────────────────┐ │        │                     │
│ │ Card 1          │ │        │  Card 1             │
│ └─────────────────┘ │        │                     │
│ ┌─────────────────┐ │  ->    │                     │
│ │ Card 2          │ │        │  Card 2             │
│ └─────────────────┘ │        │                     │
│ ┌─────────────────┐ │        │                     │
│ │ Card 3          │ │        │  Card 3             │
│ └─────────────────┘ │        │                     │
└─────────────────────┘        └─────────────────────┘
```

Alternatives to borders:
- Box shadows (subtle elevation)
- Different background colors
- More whitespace/padding

### 5. Button Hierarchy

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  PRIMARY    →  Solid background, high contrast      │
│  ┌─────────────┐                                    │
│  │   Submit    │  bg-primary text-white             │
│  └─────────────┘                                    │
│                                                     │
│  SECONDARY  →  Outline or muted background          │
│  ┌─────────────┐                                    │
│  │   Cancel    │  border-gray-300 text-gray-700     │
│  └─────────────┘                                    │
│                                                     │
│  TERTIARY   →  Text only, like a link               │
│  ┌─────────────┐                                    │
│  │   Delete    │  text-gray-500 hover:text-gray-700 │
│  └─────────────┘                                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 6. Status Badge Styling

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Use colored borders, not backgrounds:              │
│                                                     │
│  ┌───────────┐                                      │
│  │ Assigned  │  border-purple-500 text-purple-600   │
│  └───────────┘                                      │
│                                                     │
│  ┌───────────┐                                      │
│  │ In Review │  border-yellow-500 text-yellow-600   │
│  └───────────┘                                      │
│                                                     │
│  ┌───────────┐                                      │
│  │ Completed │  border-green-500 text-green-600     │
│  └───────────┘                                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7. Mobile Typography Scale

```
┌─────────────────────────────────────────────────────┐
│ Element          │ Mobile        │ Desktop          │
├─────────────────────────────────────────────────────┤
│ Page Title       │ text-2xl (24) │ text-3xl (30)    │
│ Card Title       │ text-base (16)│ text-lg (18)     │
│ Body Text        │ text-base (16)│ text-base (16)   │
│ Secondary Text   │ text-sm (14)  │ text-sm (14)     │
│ Meta/Timestamps  │ text-sm (14)  │ text-xs (12)     │
│ Badges           │ text-sm (14)  │ text-xs (12)     │
└─────────────────────────────────────────────────────┘

Note: On mobile, smallest text should be 14px (text-sm)
      Use color/weight for hierarchy, not smaller sizes
```

### 8. Touch Targets

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Minimum touch target: 44x44px                      │
│                                                     │
│  ❌ BAD: 24x24px button                             │
│  ┌──┐                                               │
│  │  │  Too small to tap reliably                    │
│  └──┘                                               │
│                                                     │
│  ✅ GOOD: 44x44px tap area                          │
│  ┌────────────┐                                     │
│  │            │                                     │
│  │    Icon    │  Icon can be smaller, but tap      │
│  │            │  area should be 44px minimum        │
│  └────────────┘                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Quick Reference: Text Classes

| Purpose | Mobile | Desktop | Weight | Color |
|---------|--------|---------|--------|-------|
| Page title | text-2xl | text-3xl | font-bold | text-foreground |
| Card title | text-base | text-lg | font-semibold | text-foreground |
| Primary text | text-base | text-base | font-medium | text-foreground |
| Secondary text | text-sm | text-sm | font-normal | text-muted-foreground |
| Tertiary/meta | text-sm | text-xs | font-normal | text-muted-foreground/70 |

### 9. Spacing & Sizing System

Use a constrained scale based on 16px to make spacing decisions faster:

```
Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512px

Tailwind equivalents:
1 = 4px    4 = 16px   8 = 32px   16 = 64px   32 = 128px
2 = 8px    5 = 20px   10 = 40px  20 = 80px   48 = 192px
3 = 12px   6 = 24px   12 = 48px  24 = 96px   64 = 256px
```

**Key rules:**
- Adjacent values should differ by at least 25%
- Start with MORE white space, then remove until it looks right
- Don't agonize between 120px and 125px — use the system

### 10. Line Length

```
Optimal line length: 45-75 characters per line

Tailwind classes:
- max-w-prose (65ch) - ideal for body text
- max-w-xl (36rem) - good for cards/panels
- max-w-2xl (42rem) - wider content areas
```

### 11. Grids Are Overrated

```
❌ BAD: Everything percentage-based
┌────────────────────────────────────────┐
│  Sidebar (25%)  │  Main Content (75%)  │
│  ← gets too     │  ← wastes space on   │
│     wide →      │     wide screens     │
└────────────────────────────────────────┘

✅ GOOD: Fixed sidebar, flex main content
┌────────────────────────────────────────┐
│  Sidebar     │     Main Content        │
│  (240px      │     (flex-1)            │
│   fixed)     │                         │
└────────────────────────────────────────┘
```

**Key rules:**
- Sidebars: Fixed width (200-300px)
- Main content: Flex to fill remaining space
- Cards/modals: Use max-width, not percentage widths

### 12. Color Guidance (HSL over Hex)

```
HSL is more intuitive for creating color variations:

hsl(hue, saturation%, lightness%)
    │         │            │
    │         │            └─ 0% = black, 100% = white
    │         └─ 0% = grey, 100% = vivid
    └─ 0-360° color wheel (0=red, 120=green, 240=blue)

Creating shades:
- Darker: decrease lightness, INCREASE saturation
- Lighter: increase lightness, INCREASE saturation
  (to prevent washed-out colors)
```

**Define shades up front (8-10 per color):**
- 50: Lightest (backgrounds)
- 100-200: Light (hover states, secondary backgrounds)
- 300-400: Medium (borders, disabled states)
- 500-600: Base (primary buttons, links)
- 700-800: Dark (text, active states)
- 900: Darkest (headings)

### 13. Shadow Guidance

```
Emulate light from above:

Small shadow (cards):
box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);

Medium shadow (dropdowns):
box-shadow: 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);

Large shadow (modals):
box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 5px 10px rgba(0,0,0,0.05);
```

**Two-part shadows for realism:**
1. First shadow: Sharp, small offset (direct light)
2. Second shadow: Soft, larger blur (ambient occlusion)

### 14. Labels Are a Last Resort

```
❌ Email: janedoe@example.com
✅ janedoe@example.com         <- Format speaks for itself

❌ Phone: (555) 765-4321
✅ (555) 765-4321               <- Obvious from format

❌ In Stock: 12
✅ 12 left in stock             <- Combine label with value

❌ Bedrooms: 3
✅ 3 bedrooms                   <- Natural language
```

**When you need labels:**
- De-emphasize them (smaller, lighter color)
- The data should be prominent, not the label

### 15. Avoid Ambiguous Spacing

```
❌ BAD: Equal spacing creates confusion
┌─────────────────────────────┐
│  Label                      │
│                             │  <- 16px
│  Input                      │
│                             │  <- 16px (same!)
│  Label                      │
│                             │
│  Input                      │
└─────────────────────────────┘

✅ GOOD: More space BETWEEN groups than WITHIN
┌─────────────────────────────┐
│  Label                      │
│                             │  <- 8px (tight)
│  Input                      │
│                             │
│                             │  <- 24px (loose)
│  Label                      │
│                             │  <- 8px (tight)
│  Input                      │
└─────────────────────────────┘
```

---

## Recommended Fonts

### For Application UI (Recommended for Pulse App)

| Font | License | Styles | Best For |
|------|---------|--------|----------|
| **Inter** | Free (OFL) | 18 | Best free UI font, excellent legibility |
| Roboto | Free (Apache) | 12 | Google's system font, very neutral |
| Open Sans | Free (Apache) | 10 | Wide letter-spacing, very readable |
| Source Sans Pro | Free (OFL) | 12 | Adobe's open-source, professional |
| Lato | Free (OFL) | 18 | Warm, friendly feel |
| Proxima Nova | Paid | 16 | Premium, widely used |
| Graphik | Paid | 18 | Modern, geometric |

**Recommendation for Pulse App:** Use **Inter** (free, excellent for dashboards)

### For Headlines

| Font | License | Style |
|------|---------|-------|
| Proxima Nova Bold | Paid | Clean, professional |
| Freight Sans Bold | Paid | Distinctive character |
| Roboto Black | Free | Bold, modern |
| Inter Bold | Free | Consistent with UI |

### Font Pairing Tips
- Use ONE font family for UI consistency
- Differentiate with weight (Regular vs Semibold vs Bold)
- Headlines: 600-700 weight
- Body: 400-500 weight
- Never use weights below 400 for small text

---

## Component Patterns

Reference patterns from the Component Gallery for consistent implementation:

### Buttons
- Small/large rounded, full rounded, square
- With icons (left/right), gradients, raised styles
- Primary (solid), Secondary (outline), Tertiary (text-only)

### Inputs
- Rounded, square, with borders/shadows
- Floating labels, placeholder labels
- Input groups (with buttons attached)
- Error validation styles

### Badges
- Solid background, soft background
- Thick/thin borders
- With icons, circular (for numbers)

### Navigation
- **Horizontal:** Tabs with various active states (underline, background, raised)
- **Vertical:** Sidebar with left/right borders, pill highlights, icons

### Tables
- Zebra striping, bordered, condensed
- With images, multi-row for details
- Grouping rows/columns

### Forms
- Multi-section with labels
- Two-column layouts
- Multi-page with progress indicators

### Cards
- Preview cards (with images top/left)
- Profile cards
- Pricing cards (single/multi-tier)

### Other Components
- Alerts (with icons, accent borders)
- Modals (various button layouts)
- Breadcrumbs (arrows, dots, slashes)
- Pagination (numbers, prev/next, load more)
- Activity feeds (with thumbnails, timelines)

---

## Layout Structure

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌─────────┐  ┌────────────────────────────────┐  ┌──────────────────┐  │
│  │         │  │                                │  │                  │  │
│  │ SIDEBAR │  │         MAIN CONTENT           │  │   RIGHT PANEL    │  │
│  │  200px  │  │           flex-1               │  │      320px       │  │
│  │         │  │                                │  │                  │  │
│  └─────────┘  └────────────────────────────────┘  └──────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Left Sidebar

```
┌─────────────────┐
│                 │
│   ⚡ Pulse      │  <- Logo
│                 │
├─────────────────┤
│                 │
│  🏠 Home        │  <- Active state: bg highlight
│                 │
│  📅 OOO         │
│                 │
│  ✓ Tasks        │
│                 │
│  👥 Members     │
│                 │
│  ⚙️ Settings    │  <- Admin only
│                 │
├─────────────────┤
│                 │
│                 │
│   (spacer)      │
│                 │
│                 │
├─────────────────┤
│  ❓ Help        │
│  ↪️ Log out     │
└─────────────────┘
```

---

## Main Content

### Header Section
```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  Hello, Ankush                              25 Dec, 2025  📅   │
│  Here's what's happening with your team today                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Metrics Cards (3 columns)
```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  👥              │ │  🏖️              │ │  ⚠️              │
│  Active Members  │ │  OOO Today       │ │  Stale Tasks     │
│  42              │ │  3               │ │  7               │
│  ↑ +2 this week  │ │  ↓ -1 yesterday  │ │  ↑ +3 this week  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### OOO Calendar (Weekly View)
```
┌────────────────────────────────────────────────────────────────┐
│  Out of Office                                    This Week ▼  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Mon    Tue    Wed    Thu    Fri    Sat    Sun                │
│  23     24     25     26     27     28     29                  │
│                                                                │
│  ┌──────────────────────────┐                                  │
│  │ @ankush (Dec 23-26)      │                                  │
│  └──────────────────────────┘                                  │
│         ┌─────────────────────────────┐                        │
│         │ @john (Dec 24-28)           │                        │
│         └─────────────────────────────┘                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Tasks Needing Attention
```
┌────────────────────────────────────────────────────────────────┐
│  Tasks Needing Attention                              Week ▼   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌────┐  Fix authentication bug         ● Blocked    5 days   │
│  │ AK │  @ankush                                        •••    │
│  └────┘                                                        │
│                                                                │
│  ┌────┐  Add unit tests for API         ● In Progress 4 days  │
│  │ JD │  @johndoe                                       •••    │
│  └────┘                                                        │
│                                                                │
│  ┌────┐  Update documentation           ● In Progress 3 days  │
│  │ MN │  @megan                                         •••    │
│  └────┘                                                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Right Panel

### Selected Member Profile
```
┌────────────────────────┐
│                        │
│        ┌────┐          │
│        │ AK │          │  <- Avatar
│        └────┘          │
│                        │
│     Ankush Kumar       │
│     @ankushk           │
│                        │
│   Status: 🟢 Active    │
│                        │
│   ┌────┐ ┌────┐        │
│   │ 📧 │ │ 💬 │        │  <- Contact buttons
│   └────┘ └────┘        │
│                        │
└────────────────────────┘
```

### Activity Feed
```
┌────────────────────────┐
│  Activity              │
├────────────────────────┤
│                        │
│  Ankush          10:15 │
│  Moved "Fix auth bug"  │
│  to In Progress        │
│                        │
│  ──────────────────    │
│                        │
│  John             9:30 │
│  Added progress on     │
│  "Add unit tests"      │
│  ┌──────────────────┐  │
│  │ Completed 5/10   │  │
│  │ test cases       │  │
│  └──────────────────┘  │
│                        │
│  ──────────────────    │
│                        │
│  Megan            9:00 │
│  Set OOO for           │
│  Dec 26-28             │
│                        │
└────────────────────────┘
```

---

## Color Palette

| Purpose | Color | Hex |
|---------|-------|-----|
| Primary | Blue | `#3B82F6` |
| Success/Active | Green | `#22C55E` |
| Warning/Stale | Orange | `#F59E0B` |
| Error/Blocked | Red | `#EF4444` |
| OOO | Gray | `#6B7280` |
| Background | Light Gray | `#F9FAFB` |
| Card Background | White | `#FFFFFF` |
| Text Primary | Dark Gray | `#111827` |
| Text Secondary | Medium Gray | `#6B7280` |

---

## Status Indicators

| Status | Color | Badge |
|--------|-------|-------|
| Active | Green | `● Active` |
| OOO | Gray | `● OOO` |
| Idle (>3 days) | Orange | `● Idle` |
| In Progress | Blue | `● In Progress` |
| Blocked | Red | `● Blocked` |
| Done | Green | `● Done` |

---

## Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| Desktop (>1280px) | 3 columns: Sidebar + Main + Right Panel |
| Tablet (768-1279px) | 2 columns: Sidebar + Main (Right Panel hidden, accessible via click) |
| Mobile (<768px) | 1 column: Bottom nav + Main content |

---

## Charts & Graphs

### Recommended Library: Recharts (with shadcn/ui charts)

### Chart Types

#### 1. Area Chart (Activity/Progress Over Time)
```
     ╭───────╮
    ╱        ╲      ╭──
   ╱          ╲    ╱
  ╱            ╲──╯
 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  <- Gradient fill (green to transparent)
─┴──┴──┴──┴──┴──┴──┴──
Mon Tue Wed Thu Fri Sat Sun
```
- Smooth curved lines (type="monotone")
- Gradient fill from primary color to transparent
- Use for: Task completion trends, activity over time

#### 2. Donut Chart (Percentages)
```
      ╭─────╮
    ╱    68%  ╲
   │           │
   │   Done    │
    ╲         ╱
      ╰─────╯
```
- Single metric percentage display
- Use for: Task completion rate, efficiency scores

#### 3. Bar Chart (Comparisons)
```
████████████  42
████████      28
██████        18
███           10
```
- Simple horizontal bars
- Rounded corners
- Use for: Tasks per member, status breakdown

### Chart Color Scheme

| Chart Type | Primary Color | Secondary |
|------------|---------------|-----------|
| Area fill | `#22C55E` (green) → transparent | - |
| Donut progress | `#22C55E` (green) | `#E5E7EB` (gray) |
| Bars | `#F59E0B` (orange) | `#FDE68A` (light orange) |
| Line stroke | `#3B82F6` (blue) | - |

### Example Metrics with Charts

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Tasks Done   │  │ Active Hours │  │ Efficiency   │          │
│  │              │  │              │  │              │          │
│  │    124       │  │    4.5K      │  │  ╭────╮      │          │
│  │   ↑ 12%      │  │   ↑ 8%       │  │  │68% │      │          │
│  │              │  │              │  │  ╰────╯      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Weekly Progress                                        │   │
│  │       ╭───╮                                             │   │
│  │      ╱     ╲        ╭─────                              │   │
│  │     ╱       ╲      ╱                                    │   │
│  │    ╱         ╲────╯                                     │   │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                                │   │
│  │  Mon  Tue  Wed  Thu  Fri  Sat  Sun                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │ Tasks by Status      │  │ Completion Rate      │            │
│  │                      │  │                      │            │
│  │ Done     ████████ 42│  │      ╭──────╮        │            │
│  │ Progress ██████   28│  │     ╱   68%  ╲       │            │
│  │ Blocked  ███      12│  │    │  Tasks   │       │            │
│  │ Review   ████     18│  │     ╲  Done  ╱       │            │
│  │                      │  │      ╰──────╯        │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components (shadcn/ui)

- `Card` - Metric cards, task cards
- `Avatar` - User avatars
- `Badge` - Status indicators
- `Calendar` - OOO calendar
- `DropdownMenu` - Week/Month selectors
- `ScrollArea` - Activity feed
- `Sidebar` - Navigation
- `Tooltip` - Hover information
- `Chart` - Area, Bar, Donut charts (Recharts-based)

---

## Key Interactions

1. **Click on member** → Shows profile in right panel
2. **Click on task** → Opens task detail modal
3. **Click on OOO bar** → Opens OOO detail/edit
4. **Hover on metric card** → Shows trend tooltip
5. **Click calendar icon** → Opens date picker for range

---

## Animated Icons (lucide-animated)

The app can use [lucide-animated](https://lucide-animated.com/) for select micro-interactions.
These are smooth, Motion-powered animations that enhance UX without being distracting.

### When to Use Animated Icons

| Use Case | Icon | Purpose |
|----------|------|---------|
| Loading states | `loader-pinwheel` | Indicate async operations in progress |
| Success feedback | `circle-check` | Confirm action completed successfully |
| Empty states | `search`, `folder-open` | Make empty states feel intentional |
| Refresh actions | `refresh-cw` | Indicate data sync in progress |

### When NOT to Use Animated Icons

- **Navigation icons** - Should feel stable and predictable
- **Table data icons** - Creates visual noise in data-dense views
- **Status badges** - Need to be quickly scannable
- **Decorative icons** - Animation should have purpose

### Installation

lucide-animated is NOT an npm package. Use shadcn CLI to add individual icons:

```bash
# Add specific icons via shadcn CLI
pnpm dlx shadcn@latest add "https://lucide-animated.com/r/loader-pinwheel.json"
pnpm dlx shadcn@latest add "https://lucide-animated.com/r/circle-check.json"
pnpm dlx shadcn@latest add "https://lucide-animated.com/r/folder-open.json"
pnpm dlx shadcn@latest add "https://lucide-animated.com/r/search.json"
```

This creates components in `src/components/ui/` (e.g., `loader-pinwheel.tsx`).

### Implementation Guidelines

1. **Import from the generated component:**
   ```tsx
   import { LoaderPinwheelIcon } from '@/components/ui/loader-pinwheel';
   import { CircleCheckIcon } from '@/components/ui/circle-check';
   ```

2. **Respect reduced motion preferences:**
   The library handles this automatically, but verify in testing.

3. **Use sparingly:**
   - Maximum 1-2 animated icons visible at any time
   - Animation should draw attention to important state changes
   - When in doubt, use static icons

4. **Consistent usage:**
   - If using animated `check` for success, use it everywhere
   - Don't mix animated and static versions of the same icon

### Animation Timing

- **Loading:** Continuous loop while operation in progress
- **Success:** Single play on completion, then static
- **Empty states:** Single subtle animation on mount

### Key Principle

> Animations should communicate state changes, not decorate.
> Every animation should answer "what just happened?" or "what's happening now?"
