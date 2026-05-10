# Security Policy

## Reporting Security Issues

If you discover a security vulnerability, please DO NOT open an issue. Email security concerns directly to the repository owner.

## Best Practices

### 1. Never Expose URLs in Public Repositories

⚠️ **CRITICAL**: Do not commit your actual Cloudflare Worker URL to public repositories.

- Use `YOUR_WORKER_SUBDOMAIN.workers.dev` as a placeholder in all examples
- Store your real URL in `.env` (which should be in `.gitignore`)
- If you accidentally exposed your URL, consider renaming your worker immediately

### 2. Protect Environment Variables

```bash
# Add to .gitignore
cat >> .gitignore << 'EOF'
.env
.env.local
.env.*.local
EOF
```

### 3. Rotate Secrets If Exposed

If you accidentally committed secrets:

1. **Rotate immediately**:
   ```bash
   # Generate new JWT secret
   openssl rand -base64 32

   # Update in Cloudflare
   wrangler secret put JWT_SECRET
   ```

2. **Rename worker** (invalidates old URLs):
   ```bash
   # Edit wrangler.toml
   name = "new-unique-name-$(date +%s)"

   # Redeploy
   wrangler deploy
   ```

3. **Make repository private** (GitHub settings)

### 4. KV Namespace Security

The KV namespace ID in `wrangler.toml` is less sensitive (requires auth), but consider:
- Using separate KV namespaces for dev/prod
- Setting up proper IAM permissions in Cloudflare

### 5. API Key Security

- Store `EMBEDDING_API_KEY` as a Cloudflare secret, never in code
- Use different API keys for different environments
- Rotate keys quarterly

## Security Checklist

- [ ] `.env` is in `.gitignore`
- [ ] No real URLs in code or docs (use placeholders)
- [ ] No secrets committed to history (`git log --all --full-history -- .env`)
- [ ] Repository is private (if containing any sensitive info)
- [ ] Cloudflare secrets are set via `wrangler secret put`
- [ ] Rate limiting is enabled
- [ ] Public endpoints whitelist is configured (`PUBLIC_TABLES`)

## Rate Limiting

The server includes rate limiting:

- Public endpoints: 60 requests/minute per IP
- Embedding endpoints: 30 requests/minute per user
- Authenticated endpoints: 300 requests/minute per user

Configure stricter limits in Cloudflare Dashboard if needed.

## Contact

For security issues: Create a private security advisory on GitHub or contact the repository owner directly.
