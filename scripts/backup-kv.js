#!/usr/bin/env node
/**
 * KV Backup Script
 * Creates automated backups of Cloudflare KV data
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const KV_NAMESPACE_ID = process.env.KV_NAMESPACE_ID || 'b0c25c0bfde041a69b4e560770ce6552';

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `kv-backup-${timestamp}`);

  console.log(`Creating backup at ${backupPath}...`);

  try {
    // Create backup directory
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // List all keys
    console.log('Fetching KV keys...');
    const keysOutput = execSync(`npx wrangler kv:key list --namespace-id=${KV_NAMESPACE_ID} --json`, {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    });

    const keys = JSON.parse(keysOutput);
    console.log(`Found ${keys.length} keys`);

    // Backup each key
    const backup = {};
    for (const keyObj of keys) {
      const keyName = keyObj.name;
      try {
        const value = execSync(
          `npx wrangler kv:key get --namespace-id=${KV_NAMESPACE_ID} "${keyName}"`,
          { encoding: 'utf-8', cwd: path.join(__dirname, '..') }
        );
        backup[keyName] = value;
        process.stdout.write('.');
      } catch (e) {
        console.error(`\nError backing up key ${keyName}:`, e.message);
      }
    }

    // Write backup file
    const backupFile = `${backupPath}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

    // Create metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      keyCount: keys.length,
      namespaceId: KV_NAMESPACE_ID,
      backupFile: path.basename(backupFile)
    };
    fs.writeFileSync(`${backupPath}-metadata.json`, JSON.stringify(metadata, null, 2));

    console.log(`\nBackup completed: ${backupFile}`);
    console.log(`Keys backed up: ${keys.length}`);

    // Clean old backups (keep last 30)
    cleanOldBackups();

    return backupFile;
  } catch (e) {
    console.error('Backup failed:', e.message);
    process.exit(1);
  }
}

function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('kv-backup-') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime
      }))
      .sort((a, b) => b.time - a.time);

    // Keep only last 30 backups
    if (files.length > 30) {
      const toDelete = files.slice(30);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`Deleted old backup: ${file.name}`);
      }
    }
  } catch (e) {
    console.error('Cleanup failed:', e.message);
  }
}

function restoreBackup(backupFile) {
  console.log(`Restoring from ${backupFile}...`);

  try {
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
    const keys = Object.keys(backup);

    console.log(`Restoring ${keys.length} keys...`);

    for (const key of keys) {
      try {
        execSync(
          `npx wrangler kv:key put --namespace-id=${KV_NAMESPACE_ID} "${key}" "${backup[key].replace(/"/g, '\\"')}"`,
          { cwd: path.join(__dirname, '..') }
        );
        process.stdout.write('.');
      } catch (e) {
        console.error(`\nError restoring key ${key}:`, e.message);
      }
    }

    console.log('\nRestore completed');
  } catch (e) {
    console.error('Restore failed:', e.message);
    process.exit(1);
  }
}

// CLI
const command = process.argv[2];

if (command === 'backup' || !command) {
  createBackup();
} else if (command === 'restore' && process.argv[3]) {
  restoreBackup(process.argv[3]);
} else if (command === 'list') {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('kv-backup-') && f.endsWith('.json'))
    .sort()
    .reverse();
  console.log('Available backups:');
  files.forEach(f => console.log(`  ${f}`));
} else {
  console.log(`
Usage:
  node backup-kv.js [backup|restore|list] [file]

Commands:
  backup          Create a new backup (default)
  restore <file>  Restore from backup file
  list            List available backups

Environment variables:
  BACKUP_DIR      Directory for backups (default: ./backups)
  KV_NAMESPACE_ID KV namespace ID
`);
}
