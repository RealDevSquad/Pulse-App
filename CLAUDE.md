# Pulse App - Development Guidelines

## Mobile Responsiveness

All features MUST be mobile responsive. Follow these breakpoints:

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | Single column, bottom navigation |
| Tablet | 768px - 1279px | Two columns, collapsible sidebar |
| Desktop | >= 1280px | Three columns (Sidebar + Main + Right Panel) |

### Requirements

- Test every component on mobile viewport before marking complete
- Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`)
- No horizontal scrolling on mobile
- Touch-friendly tap targets (min 44x44px)
- Collapsible/hideable panels on smaller screens

## Tech Stack

- **Framework:** Next.js 15.5.9 (App Router)
- **Language:** TypeScript
- **Database:** Firestore
- **Auth:** JWT (private key verification)
- **Styling:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **Package Manager:** pnpm

## Code Style

- Use TypeScript strict mode
- Prefer server components where possible
- Use `@/` path alias for imports
