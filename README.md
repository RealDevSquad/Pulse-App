# Pulse App

A dashboard for Real Dev Squad admins to monitor team activity, track availability, and maintain visibility into task progress.

## Features

- **OOO Tracker** - See who's out of office with calendar view
- **Task Status** - Track last movement on member tasks
- **Progress Updates** - Detailed progress logs per task
- **Admin Dashboard** - Metrics, alerts, and team management

## Tech Stack

- **Framework:** Next.js 15.2.3+ (App Router)
- **Language:** TypeScript
- **Database:** Firestore
- **Auth:** JWT (private key verification)
- **Styling:** Tailwind CSS + shadcn/ui

## Documentation

- [Product Requirements (PRD)](./docs/PRD.md)
- [Framework Decision](./docs/FRAMEWORK_DECISION.md)

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Add Firebase config and JWT private key

# Start dev server
pnpm dev
```

## License

ISC
