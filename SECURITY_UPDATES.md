# Security Hardening & Bootstrap Summary

## Changes Made

### 1. First Admin Bootstrap (`/auth/bootstrap`)
**Problem**: Chicken-and-egg - you need an admin to use admin endpoints, but you can't create an admin without being an admin.

**Solution**: New `POST /auth/bootstrap` endpoint that:
- Only works when no users exist (first-time setup)
- Creates the first user and assigns admin role automatically
- Returns 403 if users already exist (use `/auth/register` instead)

```bash
# First-time setup
curl -X POST https://your-worker.workers.dev/auth/bootstrap \
  -H 'Content-Type: application/json' \
  -d '{"email": "admin@example.com", "password": "securepassword"}'
```

### 2. Auto-Admin for First Registration
The `/auth/register` endpoint now automatically assigns admin role to the first registered user:
- If users table is empty, new user gets `admin` role
- Subsequent registrations get no special roles

### 3. Environment Variable Security
**Before**: Secrets were hardcoded in the code
**After**: All secrets must be set via environment variables:
- `JWT_SECRET` - Required for JWT signing
- `VAULT_SECRET` - Required for vault encryption
- `DB_ENCRYPTION_KEY` - Required for database encryption
- `SETUP_TOKEN` - Optional, restricts registration
- `PUBLIC_TABLES` - Optional, comma-separated list of public tables

### 4. Role-Based Access Control (RBAC)
- All admin endpoints now require `admin` role via `verifyAuth(request, 'admin')`
- Public endpoints require authentication if `JWT_SECRET` is configured
- Table whitelist for public access via `PUBLIC_TABLES` env var

### 5. Public Endpoint Restrictions
**Before**: Public endpoints accessible without auth
**After**:
- Authentication required if `JWT_SECRET` is set
- Table whitelist check: only `PUBLIC_TABLES` accessible to non-admins
- Admins can access all tables

### 6. Vault Header Parametrization
**Before**: Vault execute sent secret in both `Authorization` and `X-API-KEY` headers
**After**: Configurable header type via `headerType` parameter:
- `bearer` - `Authorization: Bearer {secret}` (default)
- `api-key` - `X-Api-Key: {secret}`
- `x-api-key` - `X-API-KEY: {secret}` (uppercase)
- `basic` - `Authorization: Basic {base64(secret)}`
- `custom` - Use `headerName` and `headerValueFormat` params

```javascript
// Custom header example
{
  "secretId": "my-api",
  "url": "https://api.example.com/data",
  "headerType": "custom",
  "headerName": "X-Custom-Auth",
  "headerValueFormat": "Token {value}"
}
```

### 7. Deploy Script Fix
Fixed bug where script exited after KV creation instead of continuing to deploy.

## Migration Guide

### For Existing Deployments
1. Set `JWT_SECRET` in Cloudflare dashboard
2. Set `VAULT_SECRET` and `DB_ENCRYPTION_KEY` if using vault/encryption
3. Use `/auth/bootstrap` to create first admin
4. Login with bootstrap credentials
5. Assign roles to existing users if needed

### For New Deployments
1. Deploy the worker
2. Call `/auth/bootstrap` to create first admin
3. Use that admin token for all operations

## Testing
Run the updated test file:
```bash
# Set environment variables
export API_URL="https://your-worker.workers.dev"
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="securepassword"

# Run tests
node test_collaboration.js
```

## API Changes

### New Endpoints
- `POST /auth/bootstrap` - Create first admin

### Modified Endpoints
- `POST /auth/register` - Now auto-assigns admin to first user
- All `/admin/*` - Now require admin role
- `/public/*` - Now require auth if JWT_SECRET is set

### Deprecated/Nothing (still works)
- All existing endpoints maintain backward compatibility
