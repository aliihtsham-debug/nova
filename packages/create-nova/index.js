#!/usr/bin/env node

/**
 * @aliihtsham-debug/create-nova — All-in-one Nova project scaffolder.
 *
 * Scaffolds a project, compiles the DSL into a full Next.js app,
 * and installs dependencies. One command = ready-to-run web app.
 *
 * Usage:
 *   npx @aliihtsham-debug/create-nova my-app
 *   npx @aliihtsham-debug/create-nova my-app --template saas
 *   npx @aliihtsham-debug/create-nova my-app --no-auth --no-git
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
const VALID_TEMPLATES = ['default', 'saas', 'crm', 'ecommerce'];

const DSL_TEMPLATES = {
  default: `entity User {
  id uuid
  name string
  email string
  role string
}

dashboard Overview {
  card TotalUsers from User
}
`,
  saas: `entity Organization {
  id uuid
  name string
  slug string
}

entity User {
  id uuid
  name string
  email string
  role string
}

entity Subscription {
  id uuid
  plan string
  status string
  user User @relation(User)
}

dashboard Admin {
  card TotalUsers from User
  card ActiveSubscriptions from Subscription where status == "active"
  chart bar PlanDistribution from Subscription by plan
}
`,
  crm: `entity Contact {
  id uuid
  firstName string
  lastName string
  email string
  company string
  status string
}

entity Deal {
  id uuid
  title string
  value money
  stage string
  contact Contact @relation(Contact)
}

dashboard Sales {
  card TotalContacts from Contact
  card OpenDeals from Deal where stage != "closed"
  chart bar DealValue from Deal by stage
  table ActiveDeals from Deal where stage != "closed" {
    column title label "Deal Name"
    column value label "Value"
    column stage label "Stage"
  }
}
`,
  ecommerce: `entity Product {
  id uuid
  name string
  price money
  sku string
  stock number
}

entity Order {
  id uuid
  total money
  status string
  product Product @relation(Product)
}

dashboard Store {
  card TotalProducts from Product
  card LowStock from Product where stock < 10
  chart line OrderTrend from Order by status
}
`,
};

// ---------------------------------------------------------------------------
// DSL file content for the generated project's app.nova (what the user edits)
// ---------------------------------------------------------------------------
function getProjectDslContent(template) {
  const header = `# Nova DSL — Edit this file and run \`npx @aliihtsham-debug/cli generate\` to regenerate the app.
# Docs: https://github.com/aliihtsham-debug/nova

`;
  return header + (DSL_TEMPLATES[template] ?? DSL_TEMPLATES['default']);
}

// ---------------------------------------------------------------------------
// DSL file content used for the initial generation (internal)
// ---------------------------------------------------------------------------
function getGenerationDslContent(template) {
  return DSL_TEMPLATES[template] ?? DSL_TEMPLATES['default'];
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log('');
  console.log('  Create a new Nova project — ready-to-run Next.js web app');
  console.log('');
  console.log('  Usage:');
  console.log('    npx @aliihtsham-debug/create-nova <project-name> [options]');
  console.log('');
  console.log('  Options:');
  console.log('    --template <type>    Template: default, saas, crm, ecommerce (default: default)');
  console.log('    --auth               Include authentication (default: true)');
  console.log('    --no-auth            Exclude authentication');
  console.log('    --billing            Include Stripe billing');
  console.log('    --no-git             Skip git initialization');
  console.log('    --skip-install       Skip npm install');
  console.log('');
  console.log('  Examples:');
  console.log('    npx @aliihtsham-debug/create-nova my-app');
  console.log('    npx @aliihtsham-debug/create-nova my-app --template saas --billing');
  console.log('    npx @aliihtsham-debug/create-nova my-app --no-auth --no-git');
  console.log('');
  process.exit(0);
}

const projectName = args[0];

let template = 'default';
let auth = true;
let billing = false;
let git = true;
let skipInstall = false;

for (let i = 1; i < args.length; i++) {
  switch (args[i]) {
    case '--template':
      template = args[++i] ?? 'default';
      break;
    case '--auth':
      auth = true;
      break;
    case '--no-auth':
      auth = false;
      break;
    case '--billing':
      billing = true;
      break;
    case '--no-git':
      git = false;
      break;
    case '--skip-install':
      skipInstall = true;
      break;
  }
}

if (!VALID_TEMPLATES.includes(template)) {
  console.error(`Unknown template '${template}'. Valid: ${VALID_TEMPLATES.join(', ')}`);
  process.exit(2);
}

const targetDir = resolve(projectName);
const outputDir = path.join(targetDir, 'generated-app');

if (fs.existsSync(targetDir)) {
  const files = fs.readdirSync(targetDir);
  if (files.length > 0) {
    console.error(`Directory '${projectName}' already exists and is not empty.`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Step 1: Scaffold project structure
// ---------------------------------------------------------------------------
console.log('');
console.log(`  Nova — Creating '${projectName}' (${template} template)`);
console.log('');

fs.mkdirSync(targetDir, { recursive: true });

// Write app.nova (the DSL file the user will edit)
fs.writeFileSync(path.join(targetDir, 'app.nova'), getProjectDslContent(template));
console.log('  Created app.nova');

// Write nova.config.ts
const configLines = [
  "import { defineConfig } from '@aliihtsham-debug/cli';",
  '',
  'export default defineConfig({',
  `  file: 'app.nova',`,
  `  output: './generated-app',`,
  `  auth: ${auth},`,
  `  billing: ${billing},`,
  '});',
  '',
];
fs.writeFileSync(path.join(targetDir, 'nova.config.ts'), configLines.join('\n'));
console.log('  Created nova.config.ts');

// Write .env.example
let envLines = '# Database\nDATABASE_URL="postgresql://user:password@localhost:5432/myapp"\n';
if (auth) {
  envLines +=
    '\n# NextAuth\nNEXTAUTH_URL="http://localhost:3000"\nNEXTAUTH_SECRET="change-me-to-a-random-secret"\n' +
    '\n# OAuth (optional)\nGOOGLE_CLIENT_ID=""\nGOOGLE_CLIENT_SECRET=""\n' +
    'GITHUB_CLIENT_ID=""\nGITHUB_CLIENT_SECRET=""\n';
}
if (billing) {
  envLines +=
    '\n# Stripe\nSTRIPE_SECRET_KEY=""\nSTRIPE_WEBHOOK_SECRET=""\nNEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""\n';
}
envLines += '\n# AI (optional)\nOPENROUTER_API_KEY=""\n';
fs.writeFileSync(path.join(targetDir, '.env.example'), envLines);
console.log('  Created .env.example');

// Write .gitignore
fs.writeFileSync(
  path.join(targetDir, '.gitignore'),
  'node_modules/\n.env\n.env.local\n.next/\nout/\ndist/\ngenerated-app/\n',
);

// Initialize git
if (git) {
  try {
    execSync('git init', { cwd: targetDir, stdio: 'ignore' });
    console.log('  Initialized git');
  } catch {
    // git not available
  }
}

// ---------------------------------------------------------------------------
// Step 2: Compile DSL → Generate Next.js app
// ---------------------------------------------------------------------------
console.log('');
console.log('  Compiling DSL...');

let compileSuccess = false;
try {
  // Import the compiler and generators
  const { compile } = await import('@aliihtsham-debug/compiler');
  const { prismaGenerator } = await import('@aliihtsham-debug/generator-prisma');
  const { zodGenerator } = await import('@aliihtsham-debug/generator-zod');
  const { nextjsGenerator } = await import('@aliihtsham-debug/generator-nextjs');

  const dslSource = getGenerationDslContent(template);

  const result = await compile(
    dslSource,
    {
      verbose: false,
      projectName,
      targetDirectory: outputDir,
      auth,
      billing,
    },
    [prismaGenerator, zodGenerator, nextjsGenerator],
  );

  if (!result.success) {
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    for (const err of errors) {
      console.error(`  Error: ${err.message}`);
    }
    console.error('\n  Compilation failed. Project scaffold created but app was not generated.');
    process.exit(2);
  }

  // Write artifacts
  fs.mkdirSync(outputDir, { recursive: true });
  let prismaGenerated = false;
  for (const artifact of result.artifacts) {
    const artifactPath = path.join(outputDir, artifact.path);
    if (artifact.type === 'directory') {
      fs.mkdirSync(artifactPath, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
      fs.writeFileSync(artifactPath, artifact.content, 'utf-8');
      if (artifact.path === 'prisma/schema.prisma') {
        prismaGenerated = true;
      }
    }
  }

  console.log(`  Generated ${result.artifacts.length} files`);
  compileSuccess = true;
} catch (err) {
  console.error(`  Compilation error: ${err.message}`);
  console.error('\n  Project scaffold created but app generation failed.');
  console.error('  Run "npx @aliihtsham-debug/cli generate" manually after fixing issues.');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Step 3: Install dependencies
// ---------------------------------------------------------------------------
if (!skipInstall) {
  console.log('');
  console.log('  Installing dependencies...');

  const installResult = spawnSync('npm', ['install'], {
    cwd: outputDir,
    stdio: 'inherit',
    shell: true,
  });

  if (installResult.status !== 0) {
    console.error('\n  npm install failed. You may need to run it manually:');
    console.error(`    cd ${projectName}/generated-app && npm install`);
  } else {
    console.log('  Dependencies installed');
  }
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------
console.log('');
console.log(`  Done! '${projectName}' is ready.\n`);
console.log('  To get started:');
console.log(`    cd ${projectName}`);
if (auth) {
  console.log('    cp .env.example .env    # configure database & secrets');
}
console.log('    cd generated-app');
console.log('    npm run dev             # start at http://localhost:3000');
console.log('');
console.log('  To customize: edit app.nova, then run:');
console.log('    npx @aliihtsham-debug/cli generate');
console.log('');
