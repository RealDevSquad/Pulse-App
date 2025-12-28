# Pulse App - Dashboard Design

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
