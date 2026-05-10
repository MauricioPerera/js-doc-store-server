# CI/CD Setup Guide

Configuring GitHub Actions for automated testing and deployment.

## Required Secrets

Configure these secrets in your GitHub repository:

### 1. CLOUDFLARE_API_TOKEN
**Purpose**: Deploy to Cloudflare Workers

**How to create**:
1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use template: "Edit Cloudflare Workers"
4. Or create custom token with permissions:
   - Account: Cloudflare Workers Scripts (Edit)
   - Zone: (optional, for custom domains)
5. Copy the token

### 2. CLOUDFLARE_ACCOUNT_ID
**Purpose**: Identify your Cloudflare account

**How to find**:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Look at the right sidebar
3. Copy "Account ID"

### 3. API_URL
**Purpose**: Run tests against your deployed worker

**Value**: Your deployed worker URL
```
https://doc-store-api-prod.YOUR_SUBDOMAIN.workers.dev
```

### 4. ADMIN_EMAIL
**Purpose**: Test authentication in CI

**Value**: Your admin email
```
admin@example.com
```

### 5. ADMIN_PASSWORD
**Purpose**: Test authentication in CI

**Value**: Your admin password
```
YourSecurePassword123!
```

## Setup Methods

### Option A: Using GitHub CLI (Recommended)

```bash
# Install gh CLI: https://cli.github.com/

# Login
git auth login

# Set secrets
git secret set CLOUDFLARE_API_TOKEN
git secret set CLOUDFLARE_ACCOUNT_ID
git secret set API_URL
git secret set ADMIN_EMAIL
git secret set ADMIN_PASSWORD
```

### Option B: Using the Setup Script

```bash
# Make script executable
chmod +x scripts/setup-github-secrets.sh

# Run script
./scripts/setup-github-secrets.sh
```

### Option C: Manual (GitHub Web Interface)

1. Go to: `https://github.com/YOUR_USERNAME/js-doc-store-server/settings/secrets/actions`
2. Click "New repository secret"
3. Add each secret:
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: (your token)
4. Repeat for all 5 secrets

## Verify Setup

### Check secrets are set:
```bash
git secret list
```

### Trigger a test run:
```bash
# Push to any branch (triggers tests)
git push origin feature/test

# Push to master (triggers tests + deploy)
git push origin master
```

## CI/CD Workflow

### On Pull Request:
- ✅ Run tests
- ✅ Security scan (TruffleHog + npm audit)
- ✅ Lint check

### On Push to Master:
- ✅ Run tests
- ✅ Security scan
- ✅ Lint check
- ✅ Deploy to Cloudflare

## Troubleshooting

### Tests failing in CI but passing locally
- Check `API_URL` secret points to deployed worker
- Verify `ADMIN_EMAIL` and `ADMIN_PASSWORD` are correct
- Ensure worker is accessible from GitHub Actions runners

### Deployment failing
- Verify `CLOUDFLARE_API_TOKEN` has correct permissions
- Check `CLOUDFLARE_ACCOUNT_ID` is correct
- Check Cloudflare dashboard for deployment errors

### Secret not found
- Secrets are not shared with forks (by design)
- Ensure you're setting secrets in the correct repository
- Verify secret names match exactly (case-sensitive)

## Security Notes

- ⚠️ Never commit secrets to the repository
- ⚠️ Secrets are not passed to workflows triggered by forks
- ✅ Use GitHub Environments for production deployments
- ✅ Rotate secrets regularly (especially API tokens)
- ✅ Use least-privilege tokens (Cloudflare permissions)

## Monitoring

View workflow runs:
```
https://github.com/YOUR_USERNAME/js-doc-store-server/actions
```

View deployment status:
```
https://dash.cloudflare.com/ -> Workers & Pages
```
