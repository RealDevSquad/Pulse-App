# TODO

## Known Issues & Future Work

### JWT Authentication Setup

When setting up JWT authentication with RS256 keys, be aware of these issues:

#### 1. Use PUBLIC Key for Verification
- RS256 tokens are **signed** with private key
- RS256 tokens are **verified** with public key
- Use `JWT_PUBLIC_KEY` env var, not `JWT_PRIVATE_KEY`

#### 2. Key Format Conversion
- RDS uses `RSA PUBLIC KEY` format (PKCS#1):
  ```
  -----BEGIN RSA PUBLIC KEY-----
  ```
- `jose` library expects `PUBLIC KEY` format (SPKI):
  ```
  -----BEGIN PUBLIC KEY-----
  ```
- Solution: Convert using Node's crypto module:
  ```typescript
  import { createPublicKey } from 'crypto';

  const keyObject = createPublicKey({ key: publicKeyPem, format: 'pem' });
  const spkiKey = keyObject.export({ type: 'spki', format: 'pem' });
  ```

#### 3. Multiline Env Variables
- PEM keys are multiline
- Next.js may not parse multiline `.env.local` values correctly
- Option A: Use single line with escaped newlines:
  ```
  JWT_PUBLIC_KEY="-----BEGIN RSA PUBLIC KEY-----\nMIIBCg...\n-----END RSA PUBLIC KEY-----"
  ```
- Option B: Store key in a file and read it at runtime

---

## UI Redesign (Refactoring UI)

Apply Refactoring UI principles from `docs/DESIGN.md` to each page.

### Breakpoints Reference

| Breakpoint | Width | Tailwind | Layout |
|------------|-------|----------|--------|
| Mobile | < 768px | Default | Single column, stacked cards |
| Tablet | 768px - 1279px | `md:` | Two columns, collapsible panels |
| Desktop | >= 1280px | `lg:` / `xl:` | Full layout with sidebars |

---

### Completed Pages

All pages have been converted to follow Refactoring UI principles:

- ✅ Tasks Page `/tasks`
- ✅ Members Page `/members`
- ✅ OOO Page `/ooo`
- ✅ Member Profile `/member/[id]`
- ✅ RDS Dashboard `/rds`
- ✅ Login Page `/login`

---

### Future Enhancements

#### Filter Bars (members, tasks, ooo)
- [ ] Mobile: horizontal scroll or dropdown
- [ ] Active filter indicator

#### Tables (all)
- [ ] Responsive column hiding on tablet

#### Cards (all)
- [ ] Hover states where clickable

---

### Checklist per Page

For each page conversion, verify:

- [x] **Typography** - Weight/color hierarchy, not just size (§1-3)
- [x] **Spacing** - Consistent scale (§9)
- [x] **Mobile first** - Cards for mobile, tables for desktop
- [x] **Touch targets** - 44x44px minimum (§8)
- [x] **Empty states** - Animated icons + helpful text
- [x] **Loading states** - Animated loader
- [x] **Status badges** - Border style, consistent colors (§6)
- [x] **Buttons** - Primary/secondary/tertiary hierarchy (§5)
- [ ] **Labels** - De-emphasize or remove redundant labels (§14)
- [ ] **Line length** - max-w-prose for text blocks (§10)
