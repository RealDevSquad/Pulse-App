# Pulse App

A dashboard for Real Dev Squad admins to monitor team activity, track availability, and maintain visibility into task progress.

## Features

- **OOO Tracker** - See who's out of office with calendar view
- **Task Status** - Track last movement on member tasks
- **Progress Updates** - Detailed progress logs per task
- **Admin Dashboard** - Metrics, alerts, and team management

## Tech Stack

- **Framework:** Next.js 15.5.9 (App Router)
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

## Local Development with RDS API

The RDS auth cookie (`rds-session`) is HTTPS-only and scoped to `.realdevsquad.com`, so it won't work with `http://localhost:3000`. To call RDS APIs locally, run the dev server on `dev.realdevsquad.com`:

**1. Add hosts entry (one-time setup):**

```bash
sudo sh -c 'echo "127.0.0.1 dev.realdevsquad.com" >> /etc/hosts'
```

**2. Start dev server with HTTPS:**

```bash
pnpm dev --experimental-https
```

On first run, it may prompt for your password to trust the self-signed certificate.

**3. Access the app:**

Open `https://dev.realdevsquad.com:3000` in your browser. Accept the self-signed certificate warning.

**4. Login:**

Go to `https://api.realdevsquad.com/auth/github/login?redirectURL=https://dev.realdevsquad.com:3000`

After GitHub auth, the cookie will be set for `.realdevsquad.com` and work with your local server.

## Deployment

The app is deployed on [Railway](https://railway.app). To deploy:

```bash
railway up
```

## License

ISC
