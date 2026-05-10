#!/usr/bin/env node
/**
 * Full Test Suite for js-doc-store-server
 * Runs all tests and reports results
 */

const { execSync } = require('child_process');
const path = require('path');

const CONFIG = {
  API_URL: process.env.API_URL || 'https://YOUR_WORKER_SUBDOMAIN.workers.dev',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Admin123!'
};

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║          FULL TEST SUITE - js-doc-store-server               ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log(`\nAPI URL: ${CONFIG.API_URL}\n`);

const tests = [
  {
    name: 'Main Functionality (test_collaboration.js)',
    file: 'test_collaboration.js',
    description: 'Login, tables, CRUD operations, vector collections'
  },
  {
    name: 'Public Endpoints (test_public_endpoints.js)',
    file: 'test_public_endpoints.js',
    description: 'Public access, authentication requirements'
  },
  {
    name: 'Embedding Integration (test_embedding_integration.js)',
    file: 'test_embedding_integration.js',
    description: 'Gemma embeddings, text-to-vector, semantic search'
  }
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  console.log(`\n${'─'.repeat(64)}`);
  console.log(`TEST: ${test.name}`);
  console.log(`DESC: ${test.description}`);
  console.log(`${'─'.repeat(64)}\n`);

  try {
    execSync(`node ${test.file}`, {
      cwd: __dirname,
      env: { ...process.env, ...CONFIG },
      stdio: 'inherit'
    });
    passed++;
    console.log(`\n✅ ${test.name} - PASSED\n`);
  } catch (e) {
    failed++;
    console.log(`\n❌ ${test.name} - FAILED\n`);
  }
}

// Summary
console.log('\n' + '═'.repeat(64));
console.log('                         TEST SUMMARY                          ');
console.log('═'.repeat(64));
console.log(`\n  Total Tests: ${tests.length}`);
console.log(`  ✅ Passed:    ${passed}`);
console.log(`  ❌ Failed:    ${failed}`);

if (failed === 0) {
  console.log('\n  🎉 ALL TESTS PASSED! 🎉\n');
  process.exit(0);
} else {
  console.log(`\n  ⚠️  ${failed} TEST(S) FAILED\n`);
  process.exit(1);
}
