# Framework Selection: Pulse App

## Recommendation: Next.js 14+ (App Router) with TypeScript

### Selected Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | Next.js 15.2.3+ (App Router) | Full-stack React, great DX, security patched |
| **Language** | TypeScript | Type safety, better maintainability |
| **Styling** | Tailwind CSS | Rapid UI development, consistent design system |
| **UI Components** | shadcn/ui | Accessible, customizable, copy-paste components |
| **Database** | Firestore | NoSQL, real-time sync, serverless, Firebase ecosystem |
| **Authentication** | JWT with private key | Stateless auth, integrates with existing RDS auth |
| **State Management** | React Query (TanStack Query) | Server state management, caching |
| **Deployment** | Vercel or Docker | Easy CI/CD, preview deployments |

---

## Why Next.js?

### Evaluated Alternatives

| Framework | Pros | Cons | Verdict |
|-----------|------|------|---------|
| **Next.js** | Mature ecosystem, SSR/SSG, API routes, great docs | Vercel-centric, can be complex | **Selected** |
| **Remix** | Great data loading, progressive enhancement | Smaller ecosystem, less community adoption | Good alternative |
| **SvelteKit** | Fast, lightweight, great DX | Smaller talent pool, less mature | Not ideal for team |
| **Nuxt (Vue)** | Good full-stack Vue option | Team may prefer React ecosystem | Depends on team |
| **T3 Stack** | Type-safe end-to-end with tRPC | More complex setup, learning curve | Consider for v2 |

### Key Reasons for Next.js

1. **Full-Stack Capability**
   - API Routes for backend logic
   - Server Components for efficient data fetching
   - No need for separate backend service initially

2. **React Ecosystem**
   - Large community and talent pool
   - Extensive component libraries
   - Easy to find solutions to problems

3. **RDS Alignment**
   - Other RDS projects likely use React
   - Consistent tech stack across organization
   - Easier for contributors to onboard

4. **Performance**
   - Server-side rendering for fast initial loads
   - Automatic code splitting
   - Built-in image optimization

5. **Developer Experience**
   - Hot module reloading
   - Great TypeScript support
   - Excellent error messages

---

## Detailed Stack Decisions

### Database: Firestore

**Why Firestore:**
- Real-time sync out of the box (great for live dashboards)
- Serverless - no database management needed
- Scales automatically
- Firebase ecosystem (Auth, Hosting, Functions if needed)
- Generous free tier (Spark plan)
- Flexible NoSQL schema

**Collections Structure:**
```
├── users/
│   └── {userId}
│       ├── githubId: string
│       ├── username: string
│       ├── role: "MEMBER" | "ADMIN" | "SUPER_ADMIN"
│       └── createdAt: timestamp
│
├── oooRecords/
│   └── {recordId}
│       ├── userId: string
│       ├── startDate: timestamp
│       ├── endDate: timestamp
│       ├── reason: string (optional)
│       └── createdAt: timestamp
│
├── tasks/
│   └── {taskId}
│       ├── externalId: string (optional)
│       ├── title: string
│       ├── status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "UNDER_REVIEW" | "COMPLETED"
│       ├── assigneeId: string
│       └── lastUpdated: timestamp
│
└── taskUpdates/
    └── {updateId}
        ├── taskId: string
        ├── content: string
        └── createdAt: timestamp
```

**TypeScript Types:**
```typescript
interface User {
  id: string;
  githubId: string;
  username: string;
  role: 'MEMBER' | 'ADMIN' | 'SUPER_ADMIN';
  createdAt: Timestamp;
}

interface OOORecord {
  id: string;
  userId: string;
  startDate: Timestamp;
  endDate: Timestamp;
  reason?: string;
  createdAt: Timestamp;
}

interface Task {
  id: string;
  externalId?: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'UNDER_REVIEW' | 'COMPLETED';
  assigneeId: string;
  lastUpdated: Timestamp;
}

interface TaskUpdate {
  id: string;
  taskId: string;
  content: string;
  createdAt: Timestamp;
}
```

### Authentication: JWT with Private Key

**Why JWT:**
- Stateless authentication - no session storage needed
- Integrates with existing RDS authentication system
- Private key verification ensures token integrity
- Works seamlessly with Next.js middleware

**Implementation:**
```typescript
// lib/auth.ts
import { jwtVerify } from 'jose';

const privateKey = new TextEncoder().encode(process.env.JWT_PRIVATE_KEY);

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, privateKey);
    return payload;
  } catch {
    return null;
  }
}

// Types for JWT payload
interface JWTPayload {
  userId: string;
  username: string;
  role: 'MEMBER' | 'ADMIN' | 'SUPER_ADMIN';
  exp: number;
}
```

**Middleware for Protected Routes:**
```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

**Configuration:**
- JWT token passed via cookie or Authorization header
- Private key stored in environment variables
- Role-based access control from token claims

### UI: Tailwind CSS + shadcn/ui

**Why Tailwind:**
- Rapid prototyping
- Consistent spacing and colors
- Great for responsive design
- Small production bundle (purged CSS)

**Why shadcn/ui:**
- Not a component library (copy-paste, fully customizable)
- Accessible by default (Radix UI primitives)
- Matches Tailwind workflow
- Components for: Tables, Calendars, Forms, Modals, etc.

---

## Project Structure

```
pulse-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Auth routes (login, callback)
│   │   ├── (dashboard)/        # Protected dashboard routes
│   │   │   ├── page.tsx        # Dashboard home
│   │   │   ├── ooo/            # OOO management
│   │   │   ├── tasks/          # Task tracking
│   │   │   └── admin/          # Admin features
│   │   ├── api/                # API routes
│   │   │   ├── auth/           # NextAuth handlers
│   │   │   ├── ooo/            # OOO CRUD
│   │   │   └── tasks/          # Task operations
│   │   ├── layout.tsx
│   │   └── page.tsx            # Landing/redirect
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── dashboard/          # Dashboard-specific components
│   │   └── shared/             # Shared components
│   ├── lib/
│   │   ├── auth.ts             # NextAuth config
│   │   ├── firebase.ts         # Firebase/Firestore client
│   │   └── utils.ts            # Utility functions
│   ├── hooks/                  # Custom React hooks
│   └── types/                  # TypeScript types
├── firestore.rules              # Firestore security rules
├── firestore.indexes.json       # Firestore indexes
├── public/
├── .env.example
├── firebase.json               # Firebase config
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## Development Setup

### Prerequisites
- Node.js 18+
- Firebase project (create at console.firebase.google.com)
- JWT private key for token verification

### Commands
```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Add Firebase config and JWT private key

# Start dev server
pnpm dev

# Deploy Firestore rules (optional)
firebase deploy --only firestore:rules
```

---

## Deployment Options

### Option 1: Vercel (Recommended for MVP)
- Zero-config deployment
- Preview deployments for PRs
- Edge functions support
- Free tier generous

### Option 2: Docker + Any Cloud
- Full control
- Works with AWS, GCP, DigitalOcean
- Good for self-hosting

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Alternatives Considered (For Future)

### If API Becomes Complex: Separate Backend
- Consider NestJS or Express for dedicated API
- Keep Next.js as frontend only

### If Real-Time Needed: Add WebSockets
- Socket.io or Pusher for live updates
- Server-Sent Events for simpler use cases

### For Type-Safe API: tRPC
- End-to-end type safety
- Can migrate to T3 stack later

---

## Decision Summary

| Decision | Choice | Confidence |
|----------|--------|------------|
| Framework | Next.js 15.2.3+ | High |
| Language | TypeScript | High |
| Database | Firestore | High |
| Auth | JWT (private key) | High |
| Styling | Tailwind + shadcn/ui | High |
| Deployment | Vercel (MVP) | Medium |

This stack provides a solid foundation that can scale with the project's needs while maintaining excellent developer experience.
