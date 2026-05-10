#!/usr/bin/env node
/**
 * Example: Custom Field Transformation
 *
 * Shows how to extend the migration with custom field types
 */

const { SchemaTransformer, RecordTransformer } = require('./airtable-migrator');

// Extend SchemaTransformer
class CustomSchemaTransformer extends SchemaTransformer {
  transformAirtableField(field) {
    // Handle custom field types
    if (field.type === 'customGeoPoint') {
      return {
        name: this.sanitizeColumnName(field.name),
        type: 'json',
        description: 'Geographic coordinates [lat, lng]'
      };
    }

    if (field.name.toLowerCase().includes('phone')) {
      const col = super.transformAirtableField(field);
      col.type = 'phone';
      return col;
    }

    return super.transformAirtableField(field);
  }
}

// Extend RecordTransformer
class CustomRecordTransformer extends RecordTransformer {
  transformValue(value, type) {
    // Custom geo point transformation
    if (type === 'json' && value?.lat && value?.lng) {
      return [value.lat, value.lng];
    }

    // Normalize phone numbers
    if (type === 'phone' && typeof value === 'string') {
      // Remove non-numeric except +
      return value.replace(/[^\d+]/g, '');
    }

    // Handle currency formatting
    if (typeof value === 'string' && value.startsWith('$')) {
      return parseFloat(value.replace(/[$,]/g, ''));
    }

    return super.transformValue(value, type);
  }
}

// Usage example
async function runCustomMigration() {
  const options = {
    apiKey: process.env.AIRTABLE_API_KEY,
    baseId: process.env.AIRTABLE_BASE_ID,
    targetUrl: 'https://your-api.com',
    logger: { log: console.log },
    schemaTransformer: new CustomSchemaTransformer(),
    recordTransformer: new CustomRecordTransformer()
  };

  // Continue with migration...
  console.log('Custom transformer ready');
}

module.exports = {
  CustomSchemaTransformer,
  CustomRecordTransformer
};

// Run if executed directly
if (require.main === module) {
  runCustomMigration();
}
