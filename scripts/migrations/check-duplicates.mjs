#!/usr/bin/env node
/**
 * Duplicate Migration Checker Script
 *
 * Finds duplicate migrations by comparing content hashes.
 * Also reports known duplicate pairs that should be archived.
 *
 * Usage: npm run db:check-duplicates
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '../../supabase/migrations');
const archivedDir = join(migrationsDir, 'archived');

// Known duplicate pairs that should be archived (later file is the duplicate)
const KNOWN_DUPLICATES = [
  {
    keep: '20251020072200_create_multi_store_schema.sql',
    archive: '20251020072557_20251020072200_create_multi_store_schema.sql',
    reason: 'Duplicate of create_multi_store_schema'
  },
  {
    keep: '20251020103000_create_technician_ready_queue.sql',
    archive: '20251020104942_20251020103000_create_technician_ready_queue.sql',
    reason: 'Duplicate of create_technician_ready_queue'
  },
  {
    keep: '20251020103100_create_queue_triggers.sql',
    archive: '20251020104957_20251020103100_create_queue_triggers.sql',
    reason: 'Duplicate of create_queue_triggers'
  },
  {
    keep: '20251020180000_add_completed_status_to_tickets.sql',
    archive: '20251020185412_add_completed_status_to_tickets.sql',
    reason: 'Duplicate of add_completed_status_to_tickets'
  }
];

// Get all SQL files (exclude template)
const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql') && !f.startsWith('_'))
  .sort();

console.log(`Checking ${files.length} migration files for duplicates...\n`);

// Hash each file's content (normalized - remove whitespace/comments)
const hashes = new Map();
const duplicatesFound = [];

for (const file of files) {
  const filepath = join(migrationsDir, file);
  const content = readFileSync(filepath, 'utf8');

  // Normalize: remove comments, extra whitespace
  const normalized = content
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/--.*$/gm, '') // Remove line comments
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toLowerCase();

  const hash = createHash('md5').update(normalized).digest('hex');

  if (hashes.has(hash)) {
    duplicatesFound.push({
      original: hashes.get(hash),
      duplicate: file
    });
  } else {
    hashes.set(hash, file);
  }
}

// Report duplicates found by content hash
console.log('='.repeat(60));
console.log('DUPLICATE CHECK RESULTS');
console.log('='.repeat(60));
console.log('');

if (duplicatesFound.length > 0) {
  console.log('DUPLICATES FOUND BY CONTENT HASH:\n');
  for (const { original, duplicate } of duplicatesFound) {
    console.log(`Original:  ${original}`);
    console.log(`Duplicate: ${duplicate}`);
    console.log('');
  }
}

// Report known duplicates status
console.log('KNOWN DUPLICATE PAIRS:\n');
let allArchived = true;

for (const { keep, archive, reason } of KNOWN_DUPLICATES) {
  const archiveExists = existsSync(join(migrationsDir, archive));
  const inArchived = existsSync(join(archivedDir, archive));

  if (archiveExists) {
    console.log(`[ ] ${archive}`);
    console.log(`    Reason: ${reason}`);
    console.log(`    Status: Still in migrations/ - should be moved to archived/`);
    console.log(`    Keep:   ${keep}`);
    allArchived = false;
  } else if (inArchived) {
    console.log(`[x] ${archive}`);
    console.log(`    Status: Already archived`);
  } else {
    console.log(`[?] ${archive}`);
    console.log(`    Status: File not found (may have been renamed or deleted)`);
  }
  console.log('');
}

// Summary
console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`New duplicates found: ${duplicatesFound.length}`);
console.log(`Known duplicates archived: ${allArchived ? 'All' : 'Some pending'}`);
console.log('');

if (duplicatesFound.length > 0 || !allArchived) {
  console.log('ACTION REQUIRED:');
  if (duplicatesFound.length > 0) {
    console.log('- Review new duplicates and move to archived/ if confirmed');
  }
  if (!allArchived) {
    console.log('- Move known duplicates to supabase/migrations/archived/');
  }
  process.exit(1);
} else {
  console.log('No duplicate issues found!');
}
