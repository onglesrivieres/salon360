#!/usr/bin/env node
/**
 * Migration Linter Script
 *
 * Checks migration files for common issues:
 * - CREATE POLICY without DROP POLICY IF EXISTS
 * - CREATE TRIGGER without DROP TRIGGER IF EXISTS
 * - CREATE FUNCTION without OR REPLACE
 * - SECURITY DEFINER without SET search_path
 * - Hardcoded Supabase URLs
 *
 * Usage: npm run db:lint
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '../../supabase/migrations');

const issues = [];
let totalFiles = 0;
let filesWithIssues = 0;

// Get all SQL files (exclude template and archived)
const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql') && !f.startsWith('_'))
  .sort();

console.log(`Linting ${files.length} migration files...\n`);

for (const file of files) {
  const filepath = join(migrationsDir, file);
  const content = readFileSync(filepath, 'utf8');
  const fileIssues = [];
  totalFiles++;

  // Check for CREATE POLICY without DROP POLICY IF EXISTS
  const createPolicyRegex = /CREATE POLICY\s+"([^"]+)"\s+ON\s+([^\s;]+)/gi;
  let match;
  while ((match = createPolicyRegex.exec(content)) !== null) {
    const policyName = match[1];
    const tableName = match[2];
    const dropPattern = new RegExp(
      `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${policyName}"\\s+ON\\s+${tableName.replace(/\./g, '\\.')}`,
      'i'
    );
    if (!dropPattern.test(content)) {
      fileIssues.push(`CREATE POLICY "${policyName}" on ${tableName} without DROP IF EXISTS guard`);
    }
  }

  // Check for CREATE TRIGGER without DROP TRIGGER IF EXISTS
  const createTriggerRegex = /CREATE TRIGGER\s+(\w+)\s+/gi;
  while ((match = createTriggerRegex.exec(content)) !== null) {
    const triggerName = match[1];
    const dropPattern = new RegExp(`DROP\\s+TRIGGER\\s+IF\\s+EXISTS\\s+${triggerName}`, 'i');
    if (!dropPattern.test(content)) {
      fileIssues.push(`CREATE TRIGGER ${triggerName} without DROP IF EXISTS guard`);
    }
  }

  // Check for CREATE FUNCTION without OR REPLACE
  const createFunctionCount = (content.match(/CREATE\s+FUNCTION/gi) || []).length;
  const createOrReplaceFunctionCount = (content.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION/gi) || []).length;
  if (createFunctionCount > createOrReplaceFunctionCount) {
    fileIssues.push(`CREATE FUNCTION without OR REPLACE (${createFunctionCount - createOrReplaceFunctionCount} occurrences)`);
  }

  // Check for SECURITY DEFINER without SET search_path
  if (content.includes('SECURITY DEFINER')) {
    // Find all SECURITY DEFINER blocks and check each one
    const securityDefinerBlocks = content.split(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i).slice(1);
    for (const block of securityDefinerBlocks) {
      if (block.includes('SECURITY DEFINER') && !block.includes('SET search_path')) {
        // Extract function name
        const funcNameMatch = block.match(/^\s*(\w+\.\w+|\w+)\s*\(/);
        const funcName = funcNameMatch ? funcNameMatch[1] : 'unknown';
        fileIssues.push(`SECURITY DEFINER function ${funcName} without SET search_path (security risk)`);
        break; // Only report once per file
      }
    }
  }

  // Check for hardcoded Supabase URLs
  if (/supabase\.co/i.test(content)) {
    fileIssues.push('Hardcoded Supabase URL detected');
  }

  if (fileIssues.length > 0) {
    issues.push({ file, issues: fileIssues });
    filesWithIssues++;
  }
}

// Report results
console.log('='.repeat(60));
console.log('MIGRATION LINT RESULTS');
console.log('='.repeat(60));
console.log('');

if (issues.length === 0) {
  console.log('All migrations pass lint checks!');
  console.log(`Checked ${totalFiles} files.`);
} else {
  console.log(`Found issues in ${filesWithIssues}/${totalFiles} files:\n`);

  for (const { file, issues: fileIssues } of issues) {
    console.log(`${file}:`);
    for (const issue of fileIssues) {
      console.log(`  - ${issue}`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total files checked: ${totalFiles}`);
  console.log(`Files with issues: ${filesWithIssues}`);
  console.log(`Total issues: ${issues.reduce((sum, f) => sum + f.issues.length, 0)}`);
  console.log('');
  console.log('To fix these issues:');
  console.log('- Add DROP POLICY IF EXISTS before CREATE POLICY');
  console.log('- Add DROP TRIGGER IF EXISTS before CREATE TRIGGER');
  console.log('- Use CREATE OR REPLACE FUNCTION instead of CREATE FUNCTION');
  console.log('- Add SET search_path = public after SECURITY DEFINER');

  process.exit(1);
}
