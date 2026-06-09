#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
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
  .action((options) => {
    const dir = options.dir ?? './generated-app';
    const port = options.port ?? '3000';
    console.log(chalk.blue(`\n◴ Starting development server on port ${port}...\n`));
    const child = spawn('npm', ['run', 'dev', '--', '--port', port], {
      cwd: dir,
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => process.exit(code ?? 0));
  });

// ─── nova test ───
program
  .command('test')
  .description('Run tests for the generated application')
  .option('--coverage', 'generate coverage report')
  .option('--watch', 'watch mode')
  .option('--e2e', 'run Playwright e2e tests')
  .option('--dir <path>', 'path to generated app', './generated-app')
  .action((options) => {
    const dir = options.dir ?? './generated-app';
    if (options.e2e) {
      console.log(chalk.blue('\n◴ Running Playwright e2e tests...\n'));
      const child = spawn('npx', ['playwright', 'test'], {
        cwd: dir,
        stdio: 'inherit',
        shell: true,
      });
      child.on('exit', (code) => process.exit(code ?? 0));
    } else {
      const args = ['vitest', 'run'];
      if (options.coverage) args.push('--coverage');
      if (options.watch) args[1] = 'watch';
      console.log(chalk.blue(`\n◴ Running ${args.slice(0, 2).join(' ')}...\n`));
      const child = spawn('npx', args, {
        cwd: dir,
        stdio: 'inherit',
        shell: true,
      });
      child.on('exit', (code) => process.exit(code ?? 0));
    }
  });

// ─── nova deploy ───
program
  .command('deploy')
  .description('Deploy the generated application')
  .option('--stage <name>', 'deployment stage (staging, production)', 'production')
  .option('--provider <name>', 'provider (vercel, railway, fly)', 'vercel')
  .option('--dir <path>', 'path to generated app', './generated-app')
  .action((options) => {
    const dir = options.dir ?? './generated-app';
    const provider = options.provider ?? 'vercel';
    const stage = options.stage ?? 'production';

    console.log(chalk.blue(`\n◹ Deploying via ${provider} (${stage})...\n`));

    let args: string[];
    switch (provider) {
      case 'vercel':
        args = stage === 'production' ? ['vercel', '--prod'] : ['vercel'];
        break;
      case 'railway':
        args = ['railway', 'up'];
        break;
      case 'fly':
        args = ['flyctl', 'deploy'];
        break;
      default:
        console.error(chalk.red(`✖ Unknown provider '${provider}'. Supported: vercel, railway, fly`));
        process.exit(1);
        return;
    }

    const child = spawn('npx', args, {
      cwd: dir,
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => process.exit(code ?? 0));
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

// ---------------------------------------------------------------------------
// Config helper (for nova.config.ts files)
// ---------------------------------------------------------------------------
export interface NovaConfig {
  /** Path to the DSL file */
  file?: string;
  /** Output directory for generated code */
  output?: string;
  /** Enable authentication */
  auth?: boolean;
  /** Enable Stripe billing */
  billing?: boolean;
  /** Additional generator options */
  generators?: Record<string, Record<string, unknown>>;
}

export function defineConfig(config: NovaConfig): NovaConfig {
  return config;
}
