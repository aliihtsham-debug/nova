#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { generateCommand } from './commands/generate.js';

const program = new Command();

program
  .name('nova')
  .description('Nova — AI-native full-stack application compiler')
  .version('0.1.0')
  .option('-v, --verbose', 'enable verbose logging')
  .option('-c, --config <path>', 'path to config file', 'nova.config.ts');

// ─── nova init ───
program
  .command('init')
  .description('Initialize a new Nova project')
  .argument('<project-name>', 'name of the project')
  .option('--template <type>', 'template type (default, saas, crm, ecommerce)', 'default')
  .option('--auth', 'include authentication', true)
  .option('--no-auth', 'exclude authentication')
  .option('--billing', 'include Stripe billing', false)
  .option('--no-git', 'skip git initialization')
  .option('--package-manager <pm>', 'package manager (pnpm, npm, yarn)', 'pnpm')
  .action(initCommand);

// ─── nova generate ───
program
  .command('generate')
  .description('Compile .nova DSL into a Next.js application')
  .option('--file <path>', 'path to DSL file', 'app.nova')
  .option('--output <dir>', 'output directory', './generated-app')
  .option('--auth', 'generate auth', true)
  .option('--no-auth', 'skip auth generation')
  .option('--billing', 'generate billing', false)
  .option('--force', 'overwrite existing output')
  .option('--no-format', 'skip prettier formatting')
  .action(generateCommand);

// ─── nova dev ───
program
  .command('dev')
  .description('Start the generated app in development mode')
  .option('--port <number>', 'port to run on', '3000')
  .option('--dir <path>', 'path to generated app', './generated-app')
  .action(async (_options) => {
    console.log(chalk.blue('ℹ nova dev — Starting development server...'));
    // Implementation: spawn `next dev` in the generated app directory
  });

// ─── nova test ───
program
  .command('test')
  .description('Run tests for the generated application')
  .option('--coverage', 'generate coverage report')
  .option('--watch', 'watch mode')
  .option('--e2e', 'run Playwright e2e tests')
  .action(async (_options) => {
    console.log(chalk.blue('ℹ nova test — Running tests...'));
    // Implementation: run vitest in the generated app
  });

// ─── nova deploy ───
program
  .command('deploy')
  .description('Deploy the generated application')
  .option('--stage <name>', 'deployment stage (staging, production)', 'production')
  .option('--provider <name>', 'provider (vercel, railway, fly)', 'vercel')
  .option('--dir <path>', 'path to generated app', './generated-app')
  .action(async (_options) => {
    console.log(chalk.blue('ℹ nova deploy — Deploying...'));
    // Implementation: run build + deploy via provider CLI
  });

// ─── Error handling ───
program.exitOverride((err) => {
  if (err.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  console.error(chalk.red(`✖ ${err.message}`));
  process.exit(1);
});

program.parse();
