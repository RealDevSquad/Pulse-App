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

### Pending Tasks

- [x] Test JWT verification with properly formatted env vars
- [x] Remove debug logging from middleware after auth is working
- [ ] Implement login redirect to RDS auth
- [ ] Fetch user details from RDS API after token verification
- [ ] Add user role/permissions to session
