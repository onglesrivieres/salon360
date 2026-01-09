#!/usr/bin/env node
/**
 * Migration Generator Script
 *
 * Creates a new timestamped migration file from the template.
 *
 * Usage: npm run db:new <migration_name>
 * Example: npm run db:new add_customer_rewards_table
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '../../supabase/migrations');
const templatePath = join(migrationsDir, '_TEMPLATE.sql');

// Get migration name from command line
const migrationName = process.argv[2];

if (!migrationName) {
  console.error('Usage: npm run db:new <migration_name>');
  console.error('Example: npm run db:new add_customer_rewards_table');
  process.exit(1);
}

// Validate migration name (snake_case, no special chars)
if (!/^[a-z][a-z0-9_]*$/.test(migrationName)) {
  console.error('Error: Migration name must be snake_case (lowercase letters, numbers, and underscores only)');
  console.error('Example: add_customer_table, fix_employee_roles, update_rls_policies');
  process.exit(1);
}

// Generate timestamp: YYYYMMDDHHMMSS
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = [
  now.getFullYear(),
  pad(now.getMonth() + 1),
  pad(now.getDate()),
  pad(now.getHours()),
  pad(now.getMinutes()),
  pad(now.getSeconds())
].join('');

const filename = `${timestamp}_${migrationName}.sql`;
const filepath = join(migrationsDir, filename);

// Check if template exists
if (!existsSync(templatePath)) {
  console.error('Error: Template file not found at:', templatePath);
  console.error('Please create supabase/migrations/_TEMPLATE.sql first');
  process.exit(1);
}

// Check if file already exists (unlikely but possible)
if (existsSync(filepath)) {
  console.error('Error: Migration file already exists:', filename);
  console.error('Wait a second and try again, or use a different name');
  process.exit(1);
}

// Read template and customize
let content = readFileSync(templatePath, 'utf8');

// Replace title placeholder with formatted migration name
const formattedTitle = migrationName
  .split('_')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

content = content.replace(
  '[Migration Title - Brief Description]',
  formattedTitle
);

// Write new migration file
writeFileSync(filepath, content);

console.log('Created migration:', filename);
console.log('Path:', filepath);
console.log('');
console.log('Next steps:');
console.log('1. Edit the migration file with your SQL changes');
console.log('2. Run: supabase db push (to apply to remote)');
console.log('3. Or run: supabase db reset (to apply to local)');
