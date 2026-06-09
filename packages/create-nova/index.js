#!/usr/bin/env node

/**
 * @aliihtsham-debug/create-nova — npx entry point for scaffolding Nova projects.
 *
 * Usage:
 *   npx @aliihtsham-debug/create-nova my-app
 *   npx @aliihtsham-debug/create-nova my-app --template saas
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

// Parse args
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log('Usage: npx @aliihtsham-debug/create-nova <project-name> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --template <type>   Template: default, saas, crm, ecommerce (default: default)');
  console.log('  --auth              Include authentication (default)');
  console.log('  --no-auth           Exclude authentication');
  console.log('  --billing           Include Stripe billing');
  console.log('  --no-git            Skip git initialization');
  process.exit(0);
}

const projectName = args[0];

// Parse options
let template = 'default';
let auth = true;
let billing = false;
let git = true;

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
  }
}

if (!VALID_TEMPLATES.includes(template)) {
  console.error(`Unknown template '${template}'. Valid: ${VALID_TEMPLATES.join(', ')}`);
  process.exit(2);
}

const targetDir = resolve(projectName);

// Check if directory exists
if (fs.existsSync(targetDir)) {
  const files = fs.readdirSync(targetDir);
  if (files.length > 0) {
    console.error(`Directory '${projectName}' already exists and is not empty.`);
    process.exit(1);
  }
}

console.log(`\nCreating Nova project '${projectName}'...\n`);

// Create directory structure
fs.mkdirSync(targetDir, { recursive: true });
fs.mkdirSync(path.join(targetDir, 'prisma'), { recursive: true });

// Write DSL file
const dslContent = DSL_TEMPLATES[template] ?? DSL_TEMPLATES['default'];
fs.writeFileSync(path.join(targetDir, 'app.nova'), dslContent);
console.log('  Created app.nova');

// Write nova.config.ts
const configLines = [
  "import { defineConfig } from '@aliihtsham-debug/cli';",
  '',
  'export default defineConfig({',
  `  source: 'app.nova',`,
  `  output: './generated-app',`,
  `  auth: ${auth},`,
  `  billing: ${billing},`,
  '});',
  '',
];
fs.writeFileSync(path.join(targetDir, 'nova.config.ts'), configLines.join('\n'));
console.log('  Created nova.config.ts');

// Write .env.example
const envLines = [
  '# Database',
  'DATABASE_URL="postgresql://user:password@localhost:5432/myapp"',
  '',
];
if (auth) {
  envLines.push(
    '# NextAuth',
    'NEXTAUTH_URL="http://localhost:3000"',
    'NEXTAUTH_SECRET="change-me-to-a-random-secret"',
    '',
    '# OAuth (optional)',
    'GOOGLE_CLIENT_ID=""',
    'GOOGLE_CLIENT_SECRET=""',
    'GITHUB_CLIENT_ID=""',
    'GITHUB_CLIENT_SECRET=""',
    '',
  );
}
if (billing) {
  envLines.push(
    '# Stripe',
    'STRIPE_SECRET_KEY=""',
    'STRIPE_WEBHOOK_SECRET=""',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""',
    '',
  );
}
envLines.push('# AI (optional)', 'OPENROUTER_API_KEY=""', '');
fs.writeFileSync(path.join(targetDir, '.env.example'), envLines.join('\n'));
console.log('  Created .env.example');

// Write .gitignore
fs.writeFileSync(
  path.join(targetDir, '.gitignore'),
  'node_modules/\n.env\n.env.local\n.next/\nout/\ndist/\ngenerated-app/\n',
);
console.log('  Created .gitignore');

// Write README
fs.writeFileSync(
  path.join(targetDir, 'README.md'),
  `# ${projectName}\n\nGenerated by Nova.\n\n## Getting Started\n\n1. Copy \`.env.example\` to \`.env\` and fill in values\n2. Run \`npx @aliihtsham-debug/cli generate\` to compile the DSL\n3. Run \`cd generated-app && npm install && npm run dev\`\n`,
);
console.log('  Created README.md');

// Initialize git
if (git) {
  try {
    execSync('git init', { cwd: targetDir, stdio: 'ignore' });
    console.log('  Initialized git repository');
  } catch {
    console.log('  Git not found, skipping');
  }
}

console.log(`\nProject '${projectName}' created successfully!\n`);
console.log('Next steps:');
console.log(`  cd ${projectName}`);
console.log('  cp .env.example .env');
console.log('  npx @aliihtsham-debug/cli generate');
