#!/usr/bin/env node
/**
 * Attachment Migration Helper
 * Downloads attachments from Airtable and prepares for R2/S3 upload
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

class AttachmentMigrator {
  constructor(options) {
    this.outputDir = options.outputDir || './attachments';
    this.concurrency = options.concurrency || 5;
    this.logger = options.logger || console;
  }

  async downloadAttachment(url, filename) {
    const outputPath = path.join(this.outputDir, filename);

    return new Promise((resolve, reject) => {
      const file = require('fs').createWriteStream(outputPath);

      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve({ path: outputPath, size: response.headers['content-length'] });
        });
      }).on('error', reject);
    });
  }

  async processBatch(attachments) {
    const results = [];

    for (let i = 0; i < attachments.length; i += this.concurrency) {
      const batch = attachments.slice(i, i + this.concurrency);
      const promises = batch.map(async (att) => {
        try {
          const result = await this.downloadAttachment(att.url, att.filename);
          return { success: true, ...result, original: att };
        } catch (err) {
          return { success: false, error: err.message, original: att };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      // Progress indicator
      this.logger.log(`Downloaded ${Math.min(i + this.concurrency, attachments.length)}/${attachments.length}`);
    }

    return results;
  }

  async run(attachmentList) {
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    // Save attachment manifest
    const manifestPath = path.join(this.outputDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(attachmentList, null, 2));

    // Download attachments
    this.logger.log(`Downloading ${attachmentList.length} attachments...`);
    const results = await this.processBatch(attachmentList);

    // Generate upload script for R2
    const uploadScript = this.generateR2UploadScript(results);
    await fs.writeFile(path.join(this.outputDir, 'upload-to-r2.sh'), uploadScript);

    // Summary
    const successful = results.filter(r => r.success).length;
    this.logger.log(`\nDownload complete: ${successful}/${attachmentList.length} successful`);
    this.logger.log(`Files saved to: ${path.resolve(this.outputDir)}`);
    this.logger.log(`Run ./upload-to-r2.sh to upload to Cloudflare R2`);

    return results;
  }

  generateR2UploadScript(results) {
    const successful = results.filter(r => r.success);

    const commands = successful.map(r => {
      const r2Path = `attachments/${r.original.table}/${r.original.recordId}/${r.original.filename}`;
      return `wrangler r2 object put my-bucket/${r2Path} --file "${r.path}"`;
    });

    return `#!/bin/bash
# Auto-generated R2 upload script
# Run: chmod +x upload-to-r2.sh && ./upload-to-r2.sh

set -e

echo "Uploading ${commands.length} files to R2..."

${commands.join('\n')}

echo "Upload complete!"
`;
  }
}

// CLI
if (require.main === module) {
  const migrator = new AttachmentMigrator({
    outputDir: process.argv[2] || './attachments'
  });

  // Example usage with manifest
  const manifest = require(path.join(process.argv[2] || './attachments', 'manifest.json'));
  migrator.run(manifest);
}

module.exports = { AttachmentMigrator };
