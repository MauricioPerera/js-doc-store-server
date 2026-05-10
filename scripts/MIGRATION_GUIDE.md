# Airtable → js-doc-store-server Migration Guide

Complete guide for migrating from Airtable to js-doc-store-server.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Step-by-Step Migration](#step-by-step-migration)
4. [Field Mapping](#field-mapping)
5. [Handling Attachments](#handling-attachments)
6. [Post-Migration Tasks](#post-migration-tasks)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. Airtable API Access

1. Go to [Airtable Account](https://airtable.com/account)
2. Generate an API key
3. Note your base ID (found in the API documentation URL: `https://airtable.com/appXXXXXX/api/docs`)

### 2. js-doc-store-server Deployed

- Cloudflare Workers URL (e.g., `https://js-doc-store-server.YOUR_DOMAIN.workers.dev`)
- JWT token (if authentication is enabled)

### 3. Node.js

```bash
node --version  # Should be v16+
```

---

## Quick Start

```bash
# 1. Set environment variables (optional but recommended)
export AIRTABLE_API_KEY="keyXXXXXXXXXXXXXX"
export AIRTABLE_BASE_ID="appXXXXXXXXXXXXXX"

# 2. Run migration
node airtable-migrator.js \
  --api-key "$AIRTABLE_API_KEY" \
  --base-id "$AIRTABLE_BASE_ID" \
  --target-url "https://js-doc-store-server.YOUR_SUBDOMAIN.workers.dev" \
  --target-token "YOUR_JWT_TOKEN" \
  --verbose

# 3. Review results
# Tables migrated: X
# Records migrated: Y
# Errors: Z
```

---

## Step-by-Step Migration

### Phase 1: Discovery (Read-Only)

```bash
node airtable-migrator.js \
  --api-key keyXXX \
  --base-id appXXX \
  --target-url https://your-api.com \
  --dry-run \
  --verbose
```

**What this does:**
- Lists all tables in your Airtable base
- Shows field types and schema
- Calculates record counts
- **No data is written**

**Example output:**
```
[INFO] Phase 1: Discovering Airtable schema...
[VERBOSE] Processing table: Customers
[VERBOSE] Processing table: Orders
[VERBOSE] Processing table: Products
[SUCCESS] Discovered 3 tables
[INFO] [DRY RUN] Would create tables:
[INFO]   - customers
[INFO]   - orders
[INFO]   - products
```

### Phase 2: Schema Migration

```bash
node airtable-migrator.js \
  --api-key keyXXX \
  --base-id appXXX \
  --target-url https://your-api.com \
  --target-token eyJ...
```

**What this does:**
- Creates tables in js-doc-store-server
- Maps Airtable fields to js-doc-store types
- Sets up indexes (primary keys, unique fields)

### Phase 3: Data Migration

The script automatically:
1. Fetches records in batches (100 at a time)
2. Transforms data types
3. Inserts into target database
4. Logs progress

**For large bases (100k+ records):**

```bash
# Migrate table by table
node airtable-migrator.js \
  --api-key keyXXX \
  --base-id appXXX \
  --target-url https://your-api.com \
  --table-name "Customers" \
  --verbose
```

**Control de Rate Limiting:**

El script incluye rate limiting automático (4 req/segundo por defecto). Si tienes un plan pago de Airtable con límites más altos:

```bash
node airtable-migrator.js \
  --api-key keyXXX \
  --base-id appXXX \
  --target-url https://your-api.com \
  --rate-limit 10  # Ajustar según tu plan
```

### Phase 4: Verification

La validación automática ocurre después de la migración:

```
========== VALIDATION RESULTS ==========
Tables validated: 3/3

✅ All tables validated successfully!
========================================
```

Si hay discrepancias:

```
⚠️  Some tables have count mismatches:
  - customers: expected 150, got 148 (-2)
```

**Verificación manual:**

```bash
# Query migrated data
curl -X POST https://your-api.com/admin/query \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableName": "customers",
    "filter": {},
    "limit": 10
  }'
```

---

## Field Mapping

| Airtable Type | js-doc-store Type | Notes |
|---------------|-------------------|-------|
| Single line text | `text` | Direct mapping |
| Long text | `text` | Direct mapping |
| Attachment | `attachment` | URLs stored, files need separate handling |
| Checkbox | `checkbox` | Boolean |
| Date | `text` | Store as ISO string |
| Phone | `phone` | Direct mapping |
| Email | `email` | Validated |
| URL | `url` | Validated |
| Number | `number` | Direct mapping |
| Currency | `number` | Store numeric value |
| Percent | `number` | 0-100 range |
| Rating | `number` | 1-5 or custom |
| Single select | `select` | Options migrated |
| Multiple select | `multiselect` | Array of options |
| Linked record | `relation` | IDs stored, relations need manual rebuild |
| Lookup | `text` | Flattened value |
| Rollup | `number` | Computed value stored |
| Formula | `text` | Computed value stored |
| Created time | `text` | Preserved |
| Last modified time | `text` | Preserved |
| Created by | `text` | Username stored |
| Last modified by | `text` | Username stored |
| Autonumber | `autonumber` | Sequence continues |
| Barcode | `text` | Direct mapping |

**Important:**
- **Formula fields** are computed at migration time and stored as static values
- **Lookup fields** are flattened (resolved values stored, not references)
- **Rollup fields** are computed at migration time
- **Linked records** store the Airtable record ID; you'll need to rebuild relations post-migration

---

## Handling Attachments

### Option 1: Keep Airtable URLs (Quick)

Attachments remain hosted on Airtable's CDN. Works until you delete the Airtable base.

```json
{
  "attachments": [
    {
      "url": "https://dl.airtable.com/...",
      "filename": "document.pdf",
      "size": 12345,
      "type": "application/pdf"
    }
  ]
}
```

### Option 2: Migrate to Cloudflare R2 (Recommended)

```bash
# 1. Download attachments
node scripts/download-attachments.js \
  --api-key keyXXX \
  --base-id appXXX \
  --output ./attachments

# 2. Upload to R2
wrangler r2 object put bucket-name/attachments/... \
  --file ./attachments/...

# 3. Update records with new URLs
node scripts/update-attachment-urls.js \
  --target-url https://your-api.com
```

### Option 3: Skip Attachments

```bash
node airtable-migrator.js \
  --api-key keyXXX \
  --base-id appXXX \
  --target-url https://your-api.com \
  --no-attachments
```

---

## Post-Migration Tasks

### 1. Rebuild Linked Record Relations

Airtable linked records become text fields with IDs. To rebuild relations:

```javascript
// Fetch all records with linked fields
const records = await arch_query({
  tableName: "orders",
  filter: { customer_id: { $exists: true } }
});

// Update with proper relations
for (const record of records) {
  await arch_update({
    tableName: "orders",
    filter: { _id: record._id },
    update: { $set: { customer_id: record.customer_id } }
  });
}
```

### 2. Recreate Formula Fields

If you need dynamic formulas, implement as:

- **Views** (filtered queries)
- **Aggregation pipelines**
- **Computed fields in frontend**

Example:
```javascript
// Airtable formula: IF(Status="Done", "Complete", "Pending")
// Becomes aggregation:
arch_aggregate({
  tableName: "tasks",
  pipeline: [
    {
      stage: "group",
      field: "status",
      accumulators: {
        done_count: { $sum: { $cond: [{ $eq: ["$status", "Done"] }, 1, 0] } }
      }
    }
  ]
});
```

### 3. Set Up Automations

Replace Airtable Automations with:

- **Webhooks** from js-doc-store-server
- **Cloudflare Workers** scheduled jobs
- **Zapier/Make** integrations

### 4. Create User Interface

Options:
- **Retool** or **Bubble** (no-code)
- **Custom React/Vue app** (code)
- **Pi Extension** (AI-powered)

---

## Troubleshooting

### "API key is invalid"

- Check key hasn't expired
- Verify key has access to base
- Try creating a new key

### "Rate limit exceeded"

Airtable API limits: 5 requests per second

**Solution:** The script includes automatic retry with backoff. Increase delay:

```javascript
// In airtable-migrator.js
const CONFIG = {
  retryDelay: 2000, // Increase to 2 seconds
};
```

### "Some fields not migrated"

Check unsupported field types:
- Button fields (not supported)
- AI fields (not supported)
- Synced tables (need manual handling)

### "Attachments not downloading"

```bash
# Test direct download
curl -I "https://dl.airtable.com/..."

# Check permissions on attachment URLs
```

### "Large base times out"

For 100k+ record bases:

1. Migrate table by table:

```bash
# Modify script to accept --table-name flag
# Then run for each table separately
```

2. Use Airtable CSV export for initial load:

```bash
# Export from Airtable UI as CSV
# Transform CSV to JSON
# Batch insert via API
```

### "Data type mismatches"

Add custom transformation in `RecordTransformer.transformValue()`:

```javascript
case 'custom_type':
  return this.transformCustom(value);
```

---

## Example: Complete Migration

```bash
#!/bin/bash
set -e

echo "=== Airtable to js-doc-store Migration ==="

# Configuration
AIRTABLE_API_KEY="${AIRTABLE_API_KEY:-keyXXX}"
AIRTABLE_BASE_ID="${AIRTABLE_BASE_ID:-appXXX}"
TARGET_URL="https://js-doc-store-server.YOUR_SUBDOMAIN.workers.dev"
TARGET_TOKEN="eyJ..."

# Phase 1: Dry run
echo "Phase 1: Discovery (dry run)..."
node scripts/airtable-migrator.js \
  --api-key "$AIRTABLE_API_KEY" \
  --base-id "$AIRTABLE_BASE_ID" \
  --target-url "$TARGET_URL" \
  --dry-run \
  --verbose

read -p "Continue with migration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted"
  exit 1
fi

# Phase 2: Full migration
echo "Phase 2: Running migration..."
node scripts/airtable-migrator.js \
  --api-key "$AIRTABLE_API_KEY" \
  --base-id "$AIRTABLE_BASE_ID" \
  --target-url "$TARGET_URL" \
  --target-token "$TARGET_TOKEN" \
  --batch-size 100 \
  --verbose

echo "=== Migration complete ==="
echo "Verify at: $TARGET_URL/public/tables"
```

---

## Migration Checklist

- [ ] Backup Airtable base (duplicate in UI)
- [ ] Generate and test API key
- [ ] Run dry-run migration
- [ ] Review schema mapping
- [ ] Run full migration (with automatic validation)
- [ ] Review validation results
- [ ] Test CRUD operations
- [ ] Rebuild linked record relations (if needed)
- [ ] Migrate attachments (if needed)
- [ ] Set up new automations/workflows
- [ ] Train team on new system
- [ ] Sunset Airtable (after validation)

---

## Support

- **js-doc-store-server issues:** [GitHub Issues](https://github.com/MauricioPerera/js-doc-store-server/issues)
- **Airtable API docs:** https://airtable.com/developers/web/api/introduction
- **Migration questions:** Open an issue with "migration" label
