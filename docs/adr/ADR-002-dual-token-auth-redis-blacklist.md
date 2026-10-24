# ADR-002: Dual-Token Authentication with SHA-256 Hashed Refresh Tokens & Redis JTI Blacklist

## Status
`ACCEPTED` (Implemented & Verified)

## Context
A financial operations platform requires stateless, high-throughput API authentication while maintaining strict session revocation controls (e.g. immediate revocation on logout, role changes, or security deactivation). Storing plain text refresh tokens in the database exposes long-lived sessions to database leaks. Storing JWTs only in memory prevents instant invalidation before expiration.

## Decision
Implement an enterprise dual-token authentication pattern:
1. **Short-Lived Access Tokens**:
   - Format: JSON Web Token (JWT) signed with HS256.
   - Lifetime: 15 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES = 15`).
   - Claims: `sub` (user_id), `email`, `roles`, `full_name`, `jti` (unique UUID), `exp`, `iat`.
2. **Long-Lived Refresh Tokens**:
   - Format: 64-character high-entropy cryptographic hex string (`secrets.token_hex(32)`).
   - Lifetime: 7 days (`REFRESH_TOKEN_EXPIRE_DAYS = 7`).
   - Database Storage: Stored only as SHA-256 hash (`refresh_tokens.token_hash`).
   - Rotation: Rotated upon every refresh call (the old token is marked `revoked_at` and a new token issued).
3. **Immediate Revocation (Logout & Account Suspension)**:
   - On logout, the access token's `jti` is pushed to Redis with a TTL equal to its remaining lifespan (`SETEX blacklist:{jti} ttl "revoked"`).
   - All active refresh tokens for the user in PostgreSQL are updated to set `revoked_at = now()`.

## Consequences
### Positive
- Stateless authorization checks during normal requests (JWT validated cryptographically; Redis consulted in O(1) time).
- Database compromise cannot leak usable refresh tokens.
- Immediate revocation supported without waiting for JWT expiry.

### Negative
- Requires active Redis connection for token revocation checks. When Redis is down, system falls back gracefully to in-memory/cache degradation or rejects revoked checks according to configuration.

## Evidence
- [`backend/app/core/security.py`](../../backend/app/core/security.py): Functions `create_access_token`, `generate_refresh_token`, `hash_token_sha256`, `blacklist_token_jti`.
- [`backend/app/api/auth.py`](../../backend/app/api/auth.py): Endpoints `/login`, `/refresh`, `/logout`.
- [`backend/app/db/models/auth.py`](../../backend/app/db/models/auth.py): `RefreshToken` model with `token_hash` unique index.
- [`backend/tests/test_crm_rbac.py`](../../backend/tests/test_crm_rbac.py): Scenario tests verifying token blacklisting and expiry.
