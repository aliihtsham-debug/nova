#!/usr/bin/env node

/**
 * create-nova — npx entry point for scaffolding Nova projects.
 *
 * Usage:
 *   npx create-nova my-app
 *   npx create-nova my-app --template saas
 *
 * This spawns `nova init` so there is one canonical init implementation.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Forward all args to `nova init`
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: npx create-nova <project-name> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --template <type>   Template: default, saas, crm, ecommerce (default: default)');
  console.log('  --auth              Include authentication (default)');
  console.log('  --no-auth           Exclude authentication');
  console.log('  --billing           Include Stripe billing');
  console.log('  --no-git            Skip git initialization');
  console.log('  --package-manager   Package manager: pnpm, npm, yarn (default: pnpm)');
  process.exit(0);
}

const result = spawnSync('nova', ['init', ...args], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 0);
