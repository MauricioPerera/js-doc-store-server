#!/usr/bin/env node
/**
 * WordPress → js-doc-store-server Migration Script
 *
 * Usage:
 *   node wordpress-migrator.js --url https://your-wp-site.com --target-url https://...
 *
 * Options:
 *   --url                WordPress site URL (with or without /wp-json)
 *   --username          WordPress username (for Application Passwords)
 *   --password          WordPress Application Password
 *   --token             JWT token (alternative to username/password)
 *   --target-url        js-doc-store-server URL
 *   --target-token      JWT token for js-doc-store-server
 *   --batch-size        Records per batch (default: 100)
 *   --content-types     Comma-separated: posts,pages,media,users (default: all)
 *   --since             Only migrate content after date (YYYY-MM-DD)
 *   --status            Post status: publish,draft,all (default: publish)
 *   --include-media     Download media files (default: true)
 *   --dry-run           Preview without importing
 *   --verbose           Detailed logging
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Configuration
const CONFIG = {
  batchSize: 100,
  retryAttempts: 3,
  retryDelay: 1000,
  concurrency: 5,
  rateLimitPerSecond: 4,
  rateLimitWindow: 1000
};

// WordPress post types → js-doc-store table mapping
const CONTENT_TYPE_MAP = {
  'post': { table: 'posts', type: 'post' },
  'page': { table: 'pages', type: 'page' },
  'attachment': { table: 'media', type: 'media' },
  'wp_block': { table: 'blocks', type: 'reusable_block' },
  'nav_menu_item': { table: 'menu_items', type: 'menu_item' }
};

// WordPress status → js-doc-store status
const STATUS_MAP = {
  'publish': 'published',
  'draft': 'draft',
  'pending': 'pending',
  'private': 'private',
  'trash': 'archived'
};

// Logger
class Logger {
  constructor(verbose = false) {
    this.verbose = verbose;
    this.stats = {
      contentTypes: new Map(),
      records: 0,
      media: 0,
      errors: []
    };
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (level === 'error') {
      console.error(`${prefix} ${message}`);
      if (data) console.error(data);
      this.stats.errors.push({ message, data, time: timestamp });
    } else if (level === 'warn') {
      console.log(`\x1b[33m${prefix} ${message}\x1b[0m`);
      if (data && this.verbose) console.log(data);
    } else if (level === 'success') {
      console.log(`\x1b[32m${prefix} ${message}\x1b[0m`);
    } else if (this.verbose || level === 'info') {
      console.log(`${prefix} ${message}`);
    }
  }

  summary() {
    console.log('\n\n========== MIGRATION SUMMARY ==========');
    console.log(`Content types migrated: ${this.stats.contentTypes.size}`);
    for (const [type, count] of this.stats.contentTypes) {
      console.log(`  - ${type}: ${count}`);
    }
    console.log(`Total records: ${this.stats.records}`);
    console.log(`Media files: ${this.stats.media}`);
    console.log(`Errors: ${this.stats.errors.length}`);

    if (this.stats.errors.length > 0) {
      console.log('\nErrors encountered:');
      this.stats.errors.slice(0, 10).forEach((e, i) => {
        console.log(`  ${i + 1}. ${e.message}`);
      });
      if (this.stats.errors.length > 10) {
        console.log(`  ... and ${this.stats.errors.length - 10} more`);
      }
    }
    console.log('======================================\n');
  }
}

// Rate Limiter
class RateLimiter {
  constructor(requestsPerSecond = CONFIG.rateLimitPerSecond, windowMs = CONFIG.rateLimitWindow) {
    this.requestsPerWindow = requestsPerSecond;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async acquire() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.requestsPerWindow) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      if (waitTime > 0) {
        await new Promise(r => setTimeout(r, waitTime));
        return this.acquire();
      }
    }

    this.requests.push(now);
  }

  getQueueSize() {
    const now = Date.now();
    return this.requests.filter(time => now - time < this.windowMs).length;
  }
}

// HTTP utilities
async function makeRequest(url, options = {}) {
  const parsed = new URL(url);
  const client = parsed.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function withRetry(fn, attempts = CONFIG.retryAttempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, CONFIG.retryDelay * (i + 1)));
    }
  }
}

// WordPress API Client
class WordPressClient {
  constructor(siteUrl, auth, logger) {
    this.siteUrl = siteUrl.replace(/\/$/, '').replace(/\/wp-json\/?$/, '');
    this.apiUrl = `${this.siteUrl}/wp-json/wp/v2`;
    this.logger = logger;
    this.rateLimiter = new RateLimiter();
    this.totalRequests = 0;
    this.auth = this.buildAuth(auth);
  }

  buildAuth(auth) {
    if (auth.token) {
      return { Authorization: `Bearer ${auth.token}` };
    } else if (auth.username && auth.password) {
      const base64 = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      return { Authorization: `Basic ${base64}` };
    }
    return {};
  }

  async request(endpoint, options = {}) {
    await this.rateLimiter.acquire();
    this.totalRequests++;

    const url = `${this.apiUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.auth
    };

    try {
      const result = await withRetry(() => makeRequest(url, { ...options, headers }));
      return result;
    } catch (err) {
      if (err.message?.includes('401')) {
        this.logger.log('error', `Authentication failed: ${err.message}`);
        throw new Error('WordPress authentication failed. Check credentials.');
      }
      throw err;
    }
  }

  async *paginate(endpoint, options = {}) {
    let page = 1;
    let hasMore = true;
    const perPage = options.per_page || 100;

    while (hasMore) {
      const params = new URLSearchParams({
        per_page: String(perPage),
        page: String(page),
        ...options.params
      });

      const response = await this.request(`${endpoint}?${params}`);

      if (response.status !== 200) {
        this.logger.log('error', `Failed to fetch ${endpoint}: ${response.status}`);
        break;
      }

      const records = Array.isArray(response.data) ? response.data : [];

      if (records.length === 0) {
        hasMore = false;
      } else {
        yield records;
        page++;

        // Check if there are more pages from headers
        const totalPages = parseInt(response.headers['x-wp-totalpages']);
        if (totalPages && page > totalPages) {
          hasMore = false;
        }
      }
    }
  }

  async getPostTypes() {
    this.logger.log('info', 'Fetching WordPress post types...');
    const response = await this.request('/types');

    if (response.status !== 200) {
      throw new Error(`Failed to get post types: ${response.status}`);
    }

    return Object.keys(response.data || {}).filter(type =>
      !type.startsWith('wp_') || type === 'wp_block'
    );
  }

  async getUsers() {
    this.logger.log('info', 'Fetching WordPress users...');
    const users = [];

    for await (const batch of this.paginate('/users', { per_page: 100 })) {
      users.push(...batch);
    }

    return users;
  }

  async getMedia() {
    this.logger.log('info', 'Fetching WordPress media...');
    const media = [];

    for await (const batch of this.paginate('/media', { per_page: 100 })) {
      media.push(...batch);
    }

    return media;
  }

  async downloadMedia(url, outputDir) {
    return new Promise((resolve, reject) => {
      const filename = path.basename(new URL(url).pathname) || `file-${Date.now()}`;
      const outputPath = path.join(outputDir, filename);
      const client = url.startsWith('https:') ? https : http;
      const file = fs.createWriteStream(outputPath);

      client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve({ localPath: outputPath, filename, size: fs.statSync(outputPath).size });
        });
      }).on('error', reject);
    });
  }
}

// js-doc-store-server Client (same as Airtable migrator)
class JSDocStoreClient {
  constructor(baseUrl, token, logger) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.logger = logger;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return withRetry(() => makeRequest(url, { ...options, headers }));
  }

  async createTable(tableName, columns) {
    this.logger.log('verbose', `Creating table: ${tableName}`);

    const response = await this.request('/admin/create-table', {
      method: 'POST',
      body: JSON.stringify({ tableName, columns })
    });

    if (response.status !== 200 && !response.data?.success) {
      throw new Error(`Failed to create table: ${JSON.stringify(response.data)}`);
    }

    return response.data;
  }

  async batchInsert(tableName, records) {
    const response = await this.request('/admin/batch-insert', {
      method: 'POST',
      body: JSON.stringify({ tableName, records })
    });

    if (response.status !== 200 || !response.data?.success) {
      throw new Error(`Batch insert failed: ${JSON.stringify(response.data)}`);
    }

    return response.data;
  }

  async sequentialInsert(tableName, records) {
    const results = [];
    const errors = [];

    for (const record of records) {
      try {
        const response = await this.request('/admin/insert', {
          method: 'POST',
          body: JSON.stringify({ tableName, data: record })
        });
        results.push(response.data);
      } catch (err) {
        this.logger.log('error', `Failed to insert record: ${err.message}`, { id: record._wp_id });
        errors.push({ record, error: err.message });
      }
    }

    return { results, errors };
  }

  async testConnection() {
    this.logger.log('info', 'Testing js-doc-store-server connection...');
    const response = await this.request('/public/tables');

    if (response.status !== 200) {
      throw new Error(`Connection failed: ${response.status}`);
    }

    this.logger.log('success', 'Connected to js-doc-store-server');
    return response.data;
  }
}

// Schema Transformer
class SchemaTransformer {
  getTableName(contentType) {
    const mapping = CONTENT_TYPE_MAP[contentType];
    return mapping ? mapping.table : contentType.replace(/[^a-z0-9_]/g, '_');
  }

  transformPostTypeSchema(contentType) {
    const baseColumns = [
      { name: 'wp_id', type: 'number', required: true, unique: true },
      { name: 'title', type: 'text', required: true },
      { name: 'content', type: 'text' },
      { name: 'excerpt', type: 'text' },
      { name: 'slug', type: 'text', required: true },
      { name: 'status', type: 'select', options: ['published', 'draft', 'pending', 'private', 'archived'] },
      { name: 'author', type: 'text' },
      { name: 'author_id', type: 'number' },
      { name: 'created_at', type: 'text' },
      { name: 'modified_at', type: 'text' },
      { name: 'wp_type', type: 'text' },
      { name: 'featured_media', type: 'text' },
      { name: 'comment_status', type: 'select', options: ['open', 'closed'] },
      { name: 'ping_status', type: 'select', options: ['open', 'closed'] },
      { name: 'sticky', type: 'checkbox' },
      { name: 'template', type: 'text' },
      { name: 'format', type: 'text' },
      { name: 'categories', type: 'multiselect' },
      { name: 'tags', type: 'multiselect' },
      { name: 'meta', type: 'text' }
    ];

    return {
      tableName: this.getTableName(contentType),
      originalType: contentType,
      columns: baseColumns
    };
  }

  transformMediaSchema() {
    return {
      tableName: 'media',
      originalType: 'attachment',
      columns: [
        { name: 'wp_id', type: 'number', required: true, unique: true },
        { name: 'title', type: 'text' },
        { name: 'filename', type: 'text' },
        { name: 'url', type: 'url' },
        { name: 'mime_type', type: 'text' },
        { name: 'filesize', type: 'number' },
        { name: 'width', type: 'number' },
        { name: 'height', type: 'number' },
        { name: 'alt_text', type: 'text' },
        { name: 'caption', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'uploaded_at', type: 'text' },
        { name: 'author', type: 'text' },
        { name: 'meta', type: 'text' }
      ]
    };
  }

  transformUserSchema() {
    return {
      tableName: 'users',
      originalType: 'user',
      columns: [
        { name: 'wp_id', type: 'number', required: true, unique: true },
        { name: 'username', type: 'text', required: true },
        { name: 'name', type: 'text' },
        { name: 'first_name', type: 'text' },
        { name: 'last_name', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'url', type: 'url' },
        { name: 'description', type: 'text' },
        { name: 'link', type: 'url' },
        { name: 'slug', type: 'text' },
        { name: 'registered_at', type: 'text' },
        { name: 'roles', type: 'multiselect' },
        { name: 'avatar_urls', type: 'text' },
        { name: 'meta', type: 'text' }
      ]
    };
  }
}

// Record Transformer
class RecordTransformer {
  transformPost(wpPost, tableSchema) {
    const transformed = {
      _wp_id: wpPost.id,
      wp_id: wpPost.id,
      title: this.cleanHtml(wpPost.title?.rendered || ''),
      content: this.cleanHtml(wpPost.content?.rendered || ''),
      excerpt: this.cleanHtml(wpPost.excerpt?.rendered || ''),
      slug: wpPost.slug,
      status: STATUS_MAP[wpPost.status] || wpPost.status,
      author: wpPost._embedded?.author?.[0]?.name || String(wpPost.author),
      author_id: wpPost.author,
      created_at: wpPost.date,
      modified_at: wpPost.modified,
      wp_type: wpPost.type,
      featured_media: wpPost.featured_media ? String(wpPost.featured_media) : null,
      comment_status: wpPost.comment_status,
      ping_status: wpPost.ping_status,
      sticky: wpPost.sticky || false,
      template: wpPost.template || '',
      format: wpPost.format || 'standard',
      categories: wpPost.categories?.map(String) || [],
      tags: wpPost.tags?.map(String) || [],
      meta: JSON.stringify(wpPost.meta || {})
    };

    return transformed;
  }

  transformMedia(wpMedia) {
    const sizes = wpMedia.media_details?.sizes || {};
    const fullSize = sizes.full || wpMedia.media_details;

    return {
      _wp_id: wpMedia.id,
      wp_id: wpMedia.id,
      title: this.cleanHtml(wpMedia.title?.rendered || ''),
      filename: wpMedia.media_details?.file || path.basename(wpMedia.source_url),
      url: wpMedia.source_url,
      mime_type: wpMedia.mime_type,
      filesize: wpMedia.media_details?.filesize,
      width: fullSize?.width,
      height: fullSize?.height,
      alt_text: wpMedia.alt_text || '',
      caption: this.cleanHtml(wpMedia.caption?.rendered || ''),
      description: this.cleanHtml(wpMedia.description?.rendered || ''),
      uploaded_at: wpMedia.date,
      author: wpMedia._embedded?.author?.[0]?.name || String(wpMedia.author),
      meta: JSON.stringify(wpMedia.meta || {})
    };
  }

  transformUser(wpUser) {
    return {
      _wp_id: wpUser.id,
      wp_id: wpUser.id,
      username: wpUser.username || wpUser.slug,
      name: wpUser.name,
      first_name: wpUser.first_name || '',
      last_name: wpUser.last_name || '',
      email: wpUser.email || wpUser.link,
      url: wpUser.url,
      description: wpUser.description,
      link: wpUser.link,
      slug: wpUser.slug,
      registered_at: wpUser.registered_date,
      roles: wpUser.roles || [],
      avatar_urls: JSON.stringify(wpUser.avatar_urls || {}),
      meta: JSON.stringify(wpUser.meta || {})
    };
  }

  cleanHtml(html) {
    if (!html) return '';
    // Basic HTML entity decoding
    return html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#8217;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&#8230;/g, '...')
      .replace(/<[^>]*>/g, '') // Strip HTML tags
      .trim();
  }
}

// Main Migration Class
class WordPressMigrator {
  constructor(options) {
    this.wp = new WordPressClient(options.url, {
      username: options.username,
      password: options.password,
      token: options.wpToken
    }, options.logger);

    this.target = new JSDocStoreClient(options.targetUrl, options.targetToken, options.logger);
    this.schemaTransformer = new SchemaTransformer();
    this.recordTransformer = new RecordTransformer();
    this.logger = options.logger;
    this.options = options;

    this.migrationState = {
      tables: new Map(),
      records: new Map(),
      media: []
    };
  }

  async run() {
    const startTime = Date.now();

    try {
      // Phase 0: Test connections
      await this.target.testConnection();

      // Test WordPress connection
      this.logger.log('info', 'Testing WordPress connection...');
      const postTypes = await this.wp.getPostTypes();
      this.logger.log('success', `Connected to WordPress. Found ${postTypes.length} content types`);

      // Phase 1: Migrate users (if requested)
      if (this.shouldMigrate('users')) {
        await this.migrateUsers();
      }

      // Phase 2: Migrate media (if requested)
      if (this.shouldMigrate('media')) {
        await this.migrateMedia();
      }

      // Phase 3: Migrate content types
      const contentTypesToMigrate = this.options.contentTypes === 'all'
        ? postTypes
        : this.options.contentTypes.split(',').map(t => t.trim());

      for (const contentType of contentTypesToMigrate) {
        if (contentType === 'attachment') continue; // Media handled separately
        if (contentType === 'user') continue; // Users handled separately

        await this.migrateContentType(contentType);
      }

      // Phase 4: Validation
      if (!this.options.dryRun) {
        this.logger.log('info', 'Validating migration...');
        await this.validateMigration();
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.log('success', `Migration completed in ${duration}s`);

    } catch (err) {
      this.logger.log('error', `Migration failed: ${err.message}`, err.stack);
      throw err;
    } finally {
      this.logger.summary();
    }
  }

  shouldMigrate(type) {
    if (this.options.contentTypes === 'all') return true;
    return this.options.contentTypes.split(',').map(t => t.trim()).includes(type);
  }

  async migrateUsers() {
    this.logger.log('info', 'Phase: Migrating WordPress users...');

    const schema = this.schemaTransformer.transformUserSchema();
    const users = await this.wp.getUsers();

    if (this.options.dryRun) {
      this.logger.log('info', `[DRY RUN] Would migrate ${users.length} users to ${schema.tableName}`);
      return;
    }

    // Create table
    try {
      await this.target.createTable(schema.tableName, schema.columns);
    } catch (err) {
      this.logger.log('warn', `Table ${schema.tableName} may already exist: ${err.message}`);
    }

    // Transform and insert
    const transformed = users.map(u => this.recordTransformer.transformUser(u));

    if (transformed.length > 0) {
      try {
        await this.target.batchInsert(schema.tableName, transformed);
        this.logger.stats.contentTypes.set('users', transformed.length);
        this.logger.stats.records += transformed.length;
      } catch (err) {
        this.logger.log('error', `Failed to insert users: ${err.message}`);
        // Fallback to sequential
        const result = await this.target.sequentialInsert(schema.tableName, transformed);
        this.logger.stats.records += result.results.length;
      }
    }

    this.logger.log('success', `Migrated ${transformed.length} users`);
  }

  async migrateMedia() {
    this.logger.log('info', 'Phase: Migrating WordPress media...');

    const schema = this.schemaTransformer.transformMediaSchema();
    const media = await this.wp.getMedia();

    if (this.options.dryRun) {
      this.logger.log('info', `[DRY RUN] Would migrate ${media.length} media files to ${schema.tableName}`);
      return;
    }

    // Create table
    try {
      await this.target.createTable(schema.tableName, schema.columns);
    } catch (err) {
      this.logger.log('warn', `Table ${schema.tableName} may already exist: ${err.message}`);
    }

    // Transform and insert
    const transformed = media.map(m => this.recordTransformer.transformMedia(m));

    if (transformed.length > 0) {
      try {
        await this.target.batchInsert(schema.tableName, transformed);
        this.logger.stats.contentTypes.set('media', transformed.length);
        this.logger.stats.records += transformed.length;
      } catch (err) {
        this.logger.log('error', `Failed to insert media: ${err.message}`);
        const result = await this.target.sequentialInsert(schema.tableName, transformed);
        this.logger.stats.records += result.results.length;
      }
    }

    // Track media for potential download
    if (this.options.includeMedia) {
      this.migrationState.media = media.filter(m => m.source_url);
    }

    this.logger.log('success', `Migrated ${transformed.length} media items`);
  }

  async migrateContentType(contentType) {
    this.logger.log('info', `Phase: Migrating ${contentType}...`);

    const schema = this.schemaTransformer.transformPostTypeSchema(contentType);
    let totalRecords = 0;

    if (this.options.dryRun) {
      // Just count
      for await (const batch of this.wp.paginate(`/${contentType}`, {
        per_page: 100,
        params: this.options.since ? { after: `${this.options.since}T00:00:00` } : {}
      })) {
        totalRecords += batch.length;
      }
      this.logger.log('info', `[DRY RUN] Would migrate ${totalRecords} ${contentType} to ${schema.tableName}`);
      return;
    }

    // Create table
    try {
      await this.target.createTable(schema.tableName, schema.columns);
      this.logger.stats.tables = (this.logger.stats.tables || 0) + 1;
    } catch (err) {
      this.logger.log('warn', `Table ${schema.tableName} may already exist: ${err.message}`);
    }

    // Migrate records
    const params = {};
    if (this.options.since) {
      params.after = `${this.options.since}T00:00:00`;
    }
    if (this.options.status !== 'all') {
      params.status = this.options.status;
    }

    for await (const batch of this.wp.paginate(`/${contentType}`, {
      per_page: this.options.batchSize,
      params
    })) {
      const transformed = batch.map(post => {
        // Fetch embedded author data if available
        return this.recordTransformer.transformPost(post, schema);
      });

      try {
        await this.target.batchInsert(schema.tableName, transformed);
        totalRecords += transformed.length;
        this.logger.stats.records += transformed.length;
      } catch (err) {
        this.logger.log('error', `Batch insert failed: ${err.message}. Falling back...`);
        const result = await this.target.sequentialInsert(schema.tableName, transformed);
        totalRecords += result.results.length;
        this.logger.stats.records += result.results.length;
      }
    }

    this.logger.stats.contentTypes.set(contentType, totalRecords);
    this.logger.log('success', `Migrated ${totalRecords} ${contentType}`);
  }

  async validateMigration() {
    this.logger.log('info', 'Validation not fully implemented for WordPress migrator');
    // Could implement similar to Airtable migrator
  }
}

// CLI Interface
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    batchSize: 100,
    contentTypes: 'all',
    status: 'publish',
    includeMedia: true,
    dryRun: false,
    verbose: false,
    rateLimitPerSecond: CONFIG.rateLimitPerSecond
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        options.url = args[++i];
        break;
      case '--username':
        options.username = args[++i];
        break;
      case '--password':
        options.password = args[++i];
        break;
      case '--token':
        options.wpToken = args[++i];
        break;
      case '--target-url':
        options.targetUrl = args[++i];
        break;
      case '--target-token':
        options.targetToken = args[++i];
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i]) || 100;
        break;
      case '--content-types':
        options.contentTypes = args[++i];
        break;
      case '--since':
        options.since = args[++i];
        break;
      case '--status':
        options.status = args[++i];
        break;
      case '--no-media':
        options.includeMedia = false;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  // Validate required args
  if (!options.url || !options.targetUrl) {
    console.error('Error: Missing required arguments\n');
    printHelp();
    process.exit(1);
  }

  // Check auth
  if (!options.wpToken && (!options.username || !options.password)) {
    console.error('Error: WordPress authentication required (use --token OR --username + --password)\n');
    printHelp();
    process.exit(1);
  }

  return options;
}

function printHelp() {
  console.log(`
WordPress → js-doc-store-server Migration Tool

Usage: node wordpress-migrator.js [options]

Required Options:
  --url             WordPress site URL (e.g., https://example.com)
  --target-url      js-doc-store-server URL

Authentication (choose one):
  --token           WordPress JWT token (for JWT auth plugin)
  --username        WordPress username (for Application Passwords)
  --password        WordPress Application Password

Optional Options:
  --target-token    JWT token for js-doc-store-server
  --batch-size      Records per batch (default: 100)
  --content-types   Comma-separated: posts,pages,media,users (default: all)
  --since           Only migrate content after date (YYYY-MM-DD)
  --status          Post status: publish,draft,all (default: publish)
  --no-media        Skip downloading media
  --dry-run         Preview without importing
  --verbose         Detailed logging
  --help            Show this help

Environment Variables:
  WP_USERNAME       Alternative to --username
  WP_PASSWORD       Alternative to --password
  WP_TOKEN          Alternative to --token

Examples:
  # Basic migration with Application Passwords
  node wordpress-migrator.js \\
    --url https://example.com \\
    --username admin \\
    --password "xxxx xxxx xxxx xxxx xxxx" \\
    --target-url https://api.example.com

  # Migrate only posts and pages
  node wordpress-migrator.js \\
    --url https://example.com \\
    --token eyJ... \\
    --target-url https://api.example.com \\
    --content-types posts,pages

  # Dry run to preview
  node wordpress-migrator.js \\
    --url https://example.com \\
    --username admin \\
    --password "xxxx" \\
    --target-url https://api.example.com \\
    --dry-run \\
    --verbose
`);
}

// Main
async function main() {
  const options = parseArgs();

  // Override with env vars if present
  options.username = options.username || process.env.WP_USERNAME;
  options.password = options.password || process.env.WP_PASSWORD;
  options.wpToken = options.wpToken || process.env.WP_TOKEN;

  if (!options.url || !options.targetUrl) {
    console.error('Error: URL and target URL are required\n');
    printHelp();
    process.exit(1);
  }

  if (!options.wpToken && (!options.username || !options.password)) {
    console.error('Error: WordPress authentication required\n');
    printHelp();
    process.exit(1);
  }

  options.logger = new Logger(options.verbose);

  const migrator = new WordPressMigrator(options);
  await migrator.run();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
