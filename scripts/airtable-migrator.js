#!/usr/bin/env node
/**
 * Airtable → js-doc-store-server Migration Script
 *
 * Usage:
 *   node airtable-migrator.js --api-key YOUR_KEY --base-id appXXX --target-url https://...
 *
 * Options:
 *   --api-key      Airtable API key
 *   --base-id      Airtable base ID
 *   --target-url   js-doc-store-server URL
 *   --target-token JWT token for js-doc-store-server
 *   --batch-size   Records per batch (default: 100)
 *   --include-attachments  Download attachments (default: true)
 *   --dry-run      Preview without importing
 *   --verbose      Detailed logging
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
  concurrency: 5
};

// Airtable field types → js-doc-store types
const FIELD_TYPE_MAP = {
  'singleLineText': 'text',
  'email': 'email',
  'url': 'url',
  'multilineText': 'text',
  'number': 'number',
  'percent': 'number',
  'currency': 'number',
  'singleSelect': 'select',
  'multipleSelects': 'multiselect',
  'checkbox': 'checkbox',
  'date': 'text',
  'dateTime': 'text',
  'phoneNumber': 'phone',
  'multipleAttachments': 'attachment',
  'barcode': 'text',
  'rating': 'number',
  'richText': 'text',
  'duration': 'number',
  'autoNumber': 'autonumber',
  'button': 'text',
  'count': 'number',
  'createdTime': 'text',
  'lastModifiedTime': 'text',
  'formula': 'text',
  'rollup': 'number',
  'lookup': 'text',
  'createdBy': 'text',
  'lastModifiedBy': 'text',
  'singleCollaborator': 'text',
  'multipleCollaborators': 'text'
};

// Logger
class Logger {
  constructor(verbose = false) {
    this.verbose = verbose;
    this.stats = {
      tables: 0,
      records: 0,
      attachments: 0,
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
    } else if (level === 'success') {
      console.log(`\x1b[32m${prefix} ${message}\x1b[0m`);
    } else if (this.verbose || level === 'info') {
      console.log(`${prefix} ${message}`);
    }
  }

  summary() {
    console.log('\n\n========== MIGRATION SUMMARY ==========');
    console.log(`Tables migrated: ${this.stats.tables}`);
    console.log(`Records migrated: ${this.stats.records}`);
    console.log(`Attachments: ${this.stats.attachments}`);
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

// Retry wrapper
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

// Airtable API Client
class AirtableClient {
  constructor(apiKey, baseId, logger) {
    this.apiKey = apiKey;
    this.baseId = baseId;
    this.logger = logger;
    this.baseUrl = `https://api.airtable.com/v0/${baseId}`;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    return withRetry(() => makeRequest(url, { ...options, headers }));
  }

  async listTables() {
    this.logger.log('info', 'Fetching tables from Airtable...');
    const response = await this.request('/__tables__');

    if (response.status !== 200) {
      throw new Error(`Failed to list tables: ${response.status} ${JSON.stringify(response.data)}`);
    }

    return response.data.tables || [];
  }

  async getTableSchema(tableId) {
    this.logger.log('verbose', `Fetching schema for table ${tableId}`);
    const response = await this.request(`/__tables__/${tableId}`);

    if (response.status !== 200) {
      throw new Error(`Failed to get schema: ${response.status}`);
    }

    return response.data;
  }

  async *listRecords(tableIdOrName, options = {}) {
    const { pageSize = 100, fields, filterByFormula } = options;
    let offset = null;
    let totalFetched = 0;

    do {
      const params = new URLSearchParams({ pageSize: String(pageSize) });
      if (offset) params.append('offset', offset);
      if (fields) fields.forEach(f => params.append('fields[]', f));
      if (filterByFormula) params.append('filterByFormula', filterByFormula);

      const response = await this.request(`/${tableIdOrName}?${params}`);

      if (response.status !== 200) {
        throw new Error(`Failed to fetch records: ${response.status} ${JSON.stringify(response.data)}`);
      }

      const records = response.data.records || [];
      offset = response.data.offset;
      totalFetched += records.length;

      this.logger.log('verbose', `Fetched ${records.length} records (total: ${totalFetched})`);

      yield records;
    } while (offset);
  }

  async downloadAttachment(url, outputDir) {
    const filename = path.basename(new URL(url).pathname) || `attachment-${Date.now()}`;
    const outputPath = path.join(outputDir, filename);

    return new Promise((resolve, reject) => {
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

// js-doc-store-server Client
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

  async insert(tableName, data) {
    const response = await this.request('/admin/insert', {
      method: 'POST',
      body: JSON.stringify({ tableName, data })
    });

    if (response.status !== 200 || !response.data?.success) {
      throw new Error(`Insert failed: ${JSON.stringify(response.data)}`);
    }

    return response.data;
  }

  async batchInsert(tableName, records) {
    // js-doc-store-server doesn't have native batch, so we do sequential
    const results = [];
    for (const record of records) {
      try {
        const result = await this.insert(tableName, record);
        results.push(result);
      } catch (err) {
        this.logger.log('error', `Failed to insert record: ${err.message}`, record);
      }
    }
    return results;
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
  transformAirtableField(field) {
    const baseType = FIELD_TYPE_MAP[field.type] || 'text';

    const column = {
      name: this.sanitizeColumnName(field.name),
      type: baseType,
      description: field.description || undefined
    };

    // Add options for select fields
    if ((baseType === 'select' || baseType === 'multiselect') && field.options?.choices) {
      column.options = field.options.choices.map(c => c.name);
    }

    // Handle required fields
    if (field.required) {
      column.required = true;
    }

    // Handle default values
    if (field.defaultValue !== undefined && field.defaultValue !== null) {
      column.default = field.defaultValue;
    }

    // Handle unique fields (Airtable doesn't have native unique, but we can mark primary fields)
    if (field.type === 'autoNumber' || field.isPrimary) {
      column.unique = true;
    }

    return column;
  }

  sanitizeColumnName(name) {
    // Remove special characters, keep alphanumeric and underscores
    return name
      .replace(/[^a-zA-Z0-9_\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 64); // Max length
  }

  transformAirtableSchema(airtableTable) {
    const columns = airtableTable.fields
      .filter(f => !f.isComputed || f.type !== 'formula') // Skip computed/formula fields initially
      .map(f => this.transformAirtableField(f));

    return {
      tableName: this.sanitizeTableName(airtableTable.name),
      originalName: airtableTable.name,
      description: airtableTable.description,
      columns,
      primaryField: airtableTable.primaryColumnId
    };
  }

  sanitizeTableName(name) {
    return name
      .replace(/[^a-zA-Z0-9_\s]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase()
      .substring(0, 64);
  }
}

// Record Transformer
class RecordTransformer {
  constructor(schemaTransformer) {
    this.schemaTransformer = schemaTransformer;
  }

  transformRecord(airtableRecord, tableSchema) {
    const transformed = {
      _airtable_id: airtableRecord.id,
      _created_time: airtableRecord.createdTime
    };

    for (const [key, value] of Object.entries(airtableRecord.fields)) {
      const columnName = this.schemaTransformer.sanitizeColumnName(key);
      const column = tableSchema.columns.find(c => c.name === columnName);

      if (!column) continue; // Skip fields not in schema

      transformed[columnName] = this.transformValue(value, column.type);
    }

    return transformed;
  }

  transformValue(value, type) {
    if (value === null || value === undefined) return null;

    switch (type) {
      case 'attachment':
        if (Array.isArray(value)) {
          return value.map(a => ({
            url: a.url,
            filename: a.filename,
            size: a.size,
            type: a.type
          }));
        }
        return value;

      case 'select':
        return typeof value === 'string' ? value : String(value);

      case 'multiselect':
        return Array.isArray(value) ? value : [String(value)];

      case 'checkbox':
        return Boolean(value);

      case 'number':
        return typeof value === 'number' ? value : parseFloat(value) || 0;

      case 'relation':
        // Handle linked records
        if (Array.isArray(value)) {
          return value.map(r => typeof r === 'string' ? r : r.id);
        }
        return typeof value === 'string' ? value : value?.id;

      default:
        return String(value);
    }
  }
}

// Main Migration Class
class AirtableMigrator {
  constructor(options) {
    this.airtable = new AirtableClient(options.apiKey, options.baseId, options.logger);
    this.target = new JSDocStoreClient(options.targetUrl, options.targetToken, options.logger);
    this.schemaTransformer = new SchemaTransformer();
    this.recordTransformer = new RecordTransformer(this.schemaTransformer);
    this.logger = options.logger;
    this.options = options;

    this.migrationState = {
      tables: new Map(),
      records: new Map(),
      attachments: []
    };
  }

  async run() {
    const startTime = Date.now();

    try {
      // Phase 0: Test connections
      await this.target.testConnection();

      // Phase 1: Discover schema
      this.logger.log('info', 'Phase 1: Discovering Airtable schema...');
      const airtableTables = await this.discoverSchema();

      // Phase 2: Create tables in target
      if (!this.options.dryRun) {
        this.logger.log('info', 'Phase 2: Creating tables in js-doc-store-server...');
        await this.createTables(airtableTables);
      } else {
        this.logger.log('info', '[DRY RUN] Would create tables:');
        airtableTables.forEach(t => this.logger.log('info', `  - ${t.tableName}`));
      }

      // Phase 3: Migrate data
      this.logger.log('info', 'Phase 3: Migrating records...');
      await this.migrateData(airtableTables);

      // Phase 4: Handle attachments (if enabled)
      if (this.options.includeAttachments && this.migrationState.attachments.length > 0) {
        this.logger.log('info', 'Phase 4: Processing attachments...');
        await this.processAttachments();
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

  async discoverSchema() {
    const tables = await this.airtable.listTables();
    const schemas = [];

    for (const table of tables) {
      this.logger.log('verbose', `Processing table: ${table.name}`);

      try {
        const schema = await this.airtable.getTableSchema(table.id);
        const transformed = this.schemaTransformer.transformAirtableSchema(schema);
        schemas.push(transformed);
        this.migrationState.tables.set(table.id, transformed);
      } catch (err) {
        this.logger.log('error', `Failed to process table ${table.name}: ${err.message}`);
      }
    }

    this.logger.log('success', `Discovered ${schemas.length} tables`);
    return schemas;
  }

  async createTables(schemas) {
    for (const schema of schemas) {
      try {
        await this.target.createTable(schema.tableName, schema.columns);
        this.logger.stats.tables++;
      } catch (err) {
        this.logger.log('error', `Failed to create table ${schema.tableName}: ${err.message}`);
      }
    }
  }

  async migrateData(schemas) {
    for (const schema of schemas) {
      this.logger.log('info', `Migrating table: ${schema.tableName}`);

      let tableRecords = 0;

      for await (const batch of this.airtable.listRecords(schema.originalName, {
        pageSize: this.options.batchSize
      })) {
        if (this.options.dryRun) {
          this.logger.log('info', `[DRY RUN] Would migrate ${batch.length} records to ${schema.tableName}`);
          tableRecords += batch.length;
          continue;
        }

        const transformed = batch.map(r =>
          this.recordTransformer.transformRecord(r, schema)
        );

        // Collect attachments for later processing
        for (const record of transformed) {
          for (const [key, value] of Object.entries(record)) {
            if (Array.isArray(value) && value[0]?.url) {
              this.migrationState.attachments.push({
                table: schema.tableName,
                recordId: record._airtable_id,
                field: key,
                attachments: value
              });
            }
          }
        }

        try {
          await this.target.batchInsert(schema.tableName, transformed);
          tableRecords += batch.length;
          this.logger.stats.records += batch.length;
        } catch (err) {
          this.logger.log('error', `Failed to insert batch: ${err.message}`);
        }
      }

      this.logger.log('success', `Migrated ${tableRecords} records to ${schema.tableName}`);
    }
  }

  async processAttachments() {
    this.logger.log('info', `Processing ${this.migrationState.attachments.length} attachment fields`);

    // In a real implementation, you would:
    // 1. Download attachments from Airtable
    // 2. Upload to your storage (R2, S3, etc.)
    // 3. Update records with new URLs

    this.logger.log('info', '[Attachments] This would download and re-upload attachments');
    this.logger.log('info', '[Attachments] Skipped in this version - implement based on your storage');
  }
}

// CLI Interface
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    batchSize: 100,
    includeAttachments: true,
    dryRun: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--api-key':
        options.apiKey = args[++i];
        break;
      case '--base-id':
        options.baseId = args[++i];
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
      case '--no-attachments':
        options.includeAttachments = false;
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
  if (!options.apiKey || !options.baseId || !options.targetUrl) {
    console.error('Error: Missing required arguments\n');
    printHelp();
    process.exit(1);
  }

  return options;
}

function printHelp() {
  console.log(`
Airtable → js-doc-store-server Migration Tool

Usage: node airtable-migrator.js [options]

Required Options:
  --api-key        Airtable API key (or env AIRTABLE_API_KEY)
  --base-id        Airtable base ID (or env AIRTABLE_BASE_ID)
  --target-url     js-doc-store-server URL

Optional Options:
  --target-token   JWT token for authentication
  --batch-size     Records per batch (default: 100)
  --no-attachments Skip downloading attachments
  --dry-run        Preview without importing
  --verbose        Detailed logging
  --help           Show this help

Environment Variables:
  AIRTABLE_API_KEY     Alternative to --api-key
  AIRTABLE_BASE_ID     Alternative to --base-id

Examples:
  # Basic migration
  node airtable-migrator.js --api-key keyXXX --base-id appXXX --target-url https://api.example.com

  # Dry run to preview
  node airtable-migrator.js --api-key keyXXX --base-id appXXX --target-url https://api.example.com --dry-run --verbose

  # With authentication
  node airtable-migrator.js --api-key keyXXX --base-id appXXX --target-url https://api.example.com --target-token eyJ...
`);
}

// Main
async function main() {
  const options = parseArgs();

  // Override with env vars if present
  options.apiKey = options.apiKey || process.env.AIRTABLE_API_KEY;
  options.baseId = options.baseId || process.env.AIRTABLE_BASE_ID;

  if (!options.apiKey || !options.baseId) {
    console.error('Error: API key and base ID are required\n');
    printHelp();
    process.exit(1);
  }

  options.logger = new Logger(options.verbose);

  const migrator = new AirtableMigrator(options);
  await migrator.run();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
