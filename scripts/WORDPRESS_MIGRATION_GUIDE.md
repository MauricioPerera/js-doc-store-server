# WordPress → js-doc-store-server Migration Guide

Complete guide for migrating from WordPress to js-doc-store-server.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Authentication Methods](#authentication-methods)
3. [Quick Start](#quick-start)
4. [Step-by-Step Migration](#step-by-step-migration)
5. [Content Type Mapping](#content-type-mapping)
6. [Handling Media](#handling-media)
7. [Post-Migration Tasks](#post-migration-tasks)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. WordPress REST API Access

Your WordPress site must have the REST API enabled (WordPress 4.7+ includes this by default).

#### Option A: Application Passwords (Recommended)

1. Go to your WordPress admin → Users → Your Profile
2. Scroll to "Application Passwords"
3. Enter a name (e.g., "Migration Script")
4. Click "Add New Application Password"
5. **Copy the password immediately** (it won't be shown again)

#### Option B: JWT Authentication Plugin

If you prefer JWT tokens:

1. Install [JWT Authentication for WP REST API](https://wordpress.org/plugins/jwt-authentication-for-wp-rest-api/)
2. Configure as per plugin instructions
3. Obtain JWT token via `/wp-json/jwt-auth/v1/token`

### 2. js-doc-store-server Deployed

- Cloudflare Workers URL (e.g., `https://doc-store-api-prod.YOUR_DOMAIN.workers.dev`)
- JWT token (if authentication is enabled)

### 3. Node.js

```bash
node --version  # Should be v16+
```

---

## Authentication Methods

### Method 1: Application Passwords (Recommended)

```bash
node wordpress-migrator.js \
  --url https://your-wp-site.com \
  --username your-username \
  --password "xxxx xxxx xxxx xxxx xxxx" \
  --target-url https://api.example.com
```

**Security Note:** The password is a 24-character string with spaces (e.g., "abcd efgh ijkl mnop qrst uvwx").

### Method 2: JWT Token

```bash
node wordpress-migrator.js \
  --url https://your-wp-site.com \
  --token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... \
  --target-url https://api.example.com
```

---

## Quick Start

```bash
# 1. Set environment variables (optional but recommended)
export WP_USERNAME="your-wordpress-username"
export WP_PASSWORD="xxxx xxxx xxxx xxxx xxxx"

# 2. Run dry-run to preview
node wordpress-migrator.js \
  --url "https://your-wp-site.com" \
  --username "$WP_USERNAME" \
  --password "$WP_PASSWORD" \
  --target-url "https://doc-store-api-prod.rckflr.workers.dev" \
  --target-token "your-jwt-token" \
  --dry-run \
  --verbose

# 3. Review what would be migrated

# 4. Run actual migration
node wordpress-migrator.js \
  --url "https://your-wp-site.com" \
  --username "$WP_USERNAME" \
  --password "$WP_PASSWORD" \
  --target-url "https://doc-store-api-prod.rckflr.workers.dev" \
  --target-token "your-jwt-token" \
  --content-types posts,pages,media,users \
  --verbose
```

---

## Step-by-Step Migration

### Phase 1: Discovery (Read-Only)

```bash
node wordpress-migrator.js \
  --url https://your-wp-site.com \
  --username your-username \
  --password "your-app-password" \
  --target-url https://api.example.com \
  --dry-run \
  --verbose
```

**What this does:**
- Lists all content types in your WordPress site
- Shows available posts, pages, media, users
- Calculates record counts
- **No data is written**

**Example output:**
```
[INFO] Phase: Migrating WordPress users...
[INFO] [DRY RUN] Would migrate 5 users to users
[INFO] Phase: Migrating media...
[INFO] [DRY RUN] Would migrate 47 media files to media
[INFO] Phase: Migrating posts...
[INFO] [DRY RUN] Would migrate 128 posts to posts
[SUCCESS] Migration completed in 2.45s
```

### Phase 2: Selective Migration

Migrate only specific content types:

```bash
node wordpress-migrator.js \
  --url https://your-wp-site.com \
  --username your-username \
  --password "your-app-password" \
  --target-url https://api.example.com \
  --content-types posts,pages \
  --verbose
```

**Available content types:**
- `posts` - Blog posts
- `pages` - Static pages
- `media` - Media attachments
- `users` - WordPress users
- `custom_post_type` - Any custom post type

### Phase 3: Filtered Migration

Migrate only content after a specific date:

```bash
node wordpress-migrator.js \
  --url https://your-wp-site.com \
  --username your-username \
  --password "your-app-password" \
  --target-url https://api.example.com \
  --since 2024-01-01 \
  --content-types posts \
  --verbose
```

Migrate specific post status:

```bash
# Only published posts
node wordpress-migrator.js ... --status publish

# All statuses including drafts
node wordpress-migrator.js ... --status all
```

### Phase 4: Full Migration

```bash
node wordpress-migrator.js \
  --url https://your-wp-site.com \
  --username your-username \
  --password "your-app-password" \
  --target-url https://api.example.com \
  --target-token eyJ... \
  --batch-size 100 \
  --content-types all \
  --include-media \
  --verbose
```

---

## Content Type Mapping

| WordPress Type | js-doc-store Table | Notes |
|----------------|-------------------|-------|
| `post` | `posts` | Blog posts with categories/tags |
| `page` | `pages` | Static pages |
| `attachment` | `media` | Images, videos, documents |
| `user` | `users` | WordPress users with roles |
| Custom Post Types | Custom tables | Based on post type slug |

### Post Fields Mapping

| WordPress Field | js-doc-store Field | Type |
|----------------|-------------------|------|
| `id` | `wp_id` | number (unique) |
| `title.rendered` | `title` | text |
| `content.rendered` | `content` | text |
| `excerpt.rendered` | `excerpt` | text |
| `slug` | `slug` | text |
| `status` | `status` | select (mapped) |
| `author` | `author_id` | number |
| `date` | `created_at` | text (ISO) |
| `modified` | `modified_at` | text (ISO) |
| `type` | `wp_type` | text |
| `featured_media` | `featured_media` | text |
| `comment_status` | `comment_status` | select |
| `ping_status` | `ping_status` | select |
| `sticky` | `sticky` | checkbox |
| `template` | `template` | text |
| `format` | `format` | text |
| `categories` | `categories` | multiselect |
| `tags` | `tags` | multiselect |
| `meta` | `meta` | text (JSON) |

### Status Mapping

| WordPress Status | js-doc-store Status |
|------------------|---------------------|
| `publish` | `published` |
| `draft` | `draft` |
| `pending` | `pending` |
| `private` | `private` |
| `trash` | `archived` |

### User Fields Mapping

| WordPress Field | js-doc-store Field | Type |
|----------------|-------------------|------|
| `id` | `wp_id` | number (unique) |
| `username` | `username` | text |
| `name` | `name` | text |
| `first_name` | `first_name` | text |
| `last_name` | `last_name` | text |
| `email` | `email` | email |
| `url` | `url` | url |
| `description` | `description` | text |
| `slug` | `slug` | text |
| `registered_date` | `registered_at` | text |
| `roles` | `roles` | multiselect |
| `avatar_urls` | `avatar_urls` | text (JSON) |

### Media Fields Mapping

| WordPress Field | js-doc-store Field | Type |
|----------------|-------------------|------|
| `id` | `wp_id` | number (unique) |
| `title.rendered` | `title` | text |
| `media_details.file` | `filename` | text |
| `source_url` | `url` | url |
| `mime_type` | `mime_type` | text |
| `media_details.filesize` | `filesize` | number |
| `media_details.width` | `width` | number |
| `media_details.height` | `height` | number |
| `alt_text` | `alt_text` | text |
| `caption.rendered` | `caption` | text |
| `description.rendered` | `description` | text |
| `date` | `uploaded_at` | text |

---

## Handling Media

### Option 1: Keep WordPress URLs (Quick)

Media remains hosted on your WordPress server. Works as long as WordPress is accessible.

```json
{
  "url": "https://your-wp-site.com/wp-content/uploads/2024/01/image.jpg",
  "filename": "image.jpg",
  "mime_type": "image/jpeg"
}
```

This is the default behavior.

### Option 2: Download and Store Locally (Recommended)

```bash
node wordpress-migrator.js \
  --url https://your-wp-site.com \
  --username your-username \
  --password "your-app-password" \
  --target-url https://api.example.com \
  --include-media \
  --verbose
```

The script will:
1. Download media files from WordPress
2. Store metadata in js-doc-store
3. You can then upload to your own storage (R2, S3, etc.)

### Option 3: Skip Media

```bash
node wordpress-migrator.js ... --no-media
```

---

## Post-Migration Tasks

### 1. Update Internal Links

WordPress content may contain internal links that need updating:

```javascript
// Query all content
const posts = await arch_query({
  tableName: "posts",
  filter: {},
  limit: 10000
});

// Replace WordPress URLs with your new domain
for (const post of posts) {
  const updatedContent = post.content
    .replace(/https:\/\/your-wp-site\.com/g, 'https://your-new-site.com');

  await arch_update({
    tableName: "posts",
    filter: { _id: post._id },
    update: { $set: { content: updatedContent } }
  });
}
```

### 2. Rebuild Category Relationships

Categories and tags are stored as arrays. You can rebuild relationships:

```javascript
// Find all posts in a category
const techPosts = await arch_query({
  tableName: "posts",
  filter: { categories: { $in: ["Technology"] } }
});
```

### 3. Handle Featured Images

Media references are stored but files may need to be moved:

```javascript
// Get all posts with featured images
const postsWithMedia = await arch_query({
  tableName: "posts",
  filter: { featured_media: { $ne: null } }
});

// Cross-reference with media table
for (const post of postsWithMedia) {
  const media = await arch_query({
    tableName: "media",
    filter: { wp_id: parseInt(post.featured_media) }
  });

  if (media.length > 0) {
    // Update post with new media URL
    await arch_update({
      tableName: "posts",
      filter: { _id: post._id },
      update: { $set: { featured_media_url: media[0].url } }
    });
  }
}
```

### 4. Set Up Redirects

If you're replacing WordPress completely, set up redirects:

```javascript
// Example: Redirect WordPress URLs to new structure
// WordPress: /2024/01/15/hello-world/
// New: /posts/hello-world

const post = await arch_query({
  tableName: "posts",
  filter: { slug: "hello-world" }
});
```

### 5. Create User Interface

Options:
- **Retool** or **Bubble** (no-code)
- **Next.js** app with the js-doc-store API
- **Pi Extension** (AI-powered)

---

## Troubleshooting

### "Authentication failed"

- Check username and application password
- Verify REST API is enabled: `curl https://your-site.com/wp-json/wp/v2/posts`
- Try with JWT token instead

### "403 Forbidden"

Your WordPress may have security plugins blocking the API:

1. Check `.htaccess` rules
2. Disable security plugins temporarily
3. Whitelist your IP address
4. Check CORS settings

### "Some content not migrated"

Custom post types may not be exposed to REST API:

```php
// Add to your WordPress theme's functions.php
add_filter('register_post_type_args', function($args, $post_type) {
  if ($post_type === 'your_custom_type') {
    $args['show_in_rest'] = true;
  }
  return $args;
}, 10, 2);
```

### "Rate limit exceeded"

WordPress REST API has default limits. The script includes rate limiting, but you can adjust:

```bash
node wordpress-migrator.js ... --rate-limit 2
```

### "Large site times out"

For sites with 10k+ posts:

1. Migrate by content type:

```bash
# Posts first
node wordpress-migrator.js ... --content-types posts

# Then pages
node wordpress-migrator.js ... --content-types pages

# Then media
node wordpress-migrator.js ... --content-types media
```

2. Use date filtering for incremental migration:

```bash
# Only this year's content
node wordpress-migrator.js ... --since 2024-01-01
```

### "HTML entities not decoded"

The script automatically decodes common entities:
- `&amp;` → `&`
- `&lt;` → `<`
- `&gt;` → `>`
- `&quot;` → `"`
- `&#8217;` → `'`
- `&#8220;` → `"`
- `&#8221;` → `"`
- `&#8230;` → `...`

If you see other entities, add custom decoding to `RecordTransformer.cleanHtml()`.

---

## Example: Complete Migration

```bash
#!/bin/bash
set -e

echo "=== WordPress to js-doc-store Migration ==="

# Configuration
WP_URL="${WP_URL:-https://your-wp-site.com}"
WP_USERNAME="${WP_USERNAME:-admin}"
WP_PASSWORD="${WP_PASSWORD:-xxxx xxxx xxxx xxxx xxxx}"
TARGET_URL="https://doc-store-api-prod.rckflr.workers.dev"
TARGET_TOKEN="eyJ..."

# Phase 1: Dry run
echo "Phase 1: Discovery (dry run)..."
node scripts/wordpress-migrator.js \
  --url "$WP_URL" \
  --username "$WP_USERNAME" \
  --password "$WP_PASSWORD" \
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
node scripts/wordpress-migrator.js \
  --url "$WP_URL" \
  --username "$WP_USERNAME" \
  --password "$WP_PASSWORD" \
  --target-url "$TARGET_URL" \
  --target-token "$TARGET_TOKEN" \
  --content-types posts,pages,media,users \
  --batch-size 100 \
  --verbose

echo "=== Migration complete ==="
echo "Verify at: $TARGET_URL/public/tables"
```

---

## Migration Checklist

- [ ] Backup WordPress database
- [ ] Generate Application Password in WordPress
- [ ] Test WordPress REST API access
- [ ] Run dry-run migration
- [ ] Review content type mapping
- [ ] Run full migration
- [ ] Verify record counts match
- [ ] Check internal links
- [ ] Update featured images (if needed)
- [ ] Set up redirects (if replacing WordPress)
- [ ] Create new frontend UI
- [ ] Train team on new system
- [ ] Sunset WordPress (after validation)

---

## Support

- **js-doc-store-server issues:** [GitHub Issues](https://github.com/MauricioPerera/js-doc-store-server/issues)
- **WordPress REST API docs:** https://developer.wordpress.org/rest-api/
- **Migration questions:** Open an issue with "migration" label
