# Pulse App - Development Guidelines

## Design Reference

See `docs/DESIGN.md` for:
- Layout structure and wireframes
- Refactoring UI principles (typography, hierarchy, spacing)
- Color palette and status indicators
- Chart guidelines

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

## URL State (Critical)

**All filter/sort/pagination state MUST be persisted in URL params** so users can bookmark their current view. Every link that changes page state must preserve all existing filter parameters.

## Running Scripts

Scripts in `scripts/` directory should be run with:

```bash
pnpm exec tsx scripts/<script-name>.ts
```

**Note:** `ts-node` doesn't work reliably due to ESM/CJS issues. Use `tsx` instead.

Scripts must:
- Load env vars manually from `.env.local` (no dotenv package)
- Initialize Firebase Admin directly (can't import from `@/lib` due to path resolution)
- See `scripts/find-bad-tasks.ts` for reference implementation
