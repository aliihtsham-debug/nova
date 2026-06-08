// ---------------------------------------------------------------------------
// Nova DSL — Generate script
// Compiles app.nova into a full Next.js application
// ---------------------------------------------------------------------------

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dynamically import the built packages
const { compile } = await import('./packages/compiler/dist/index.js');
const { prismaGenerator } = await import('./packages/generator-prisma/dist/index.js');
const { zodGenerator } = await import('./packages/generator-zod/dist/index.js');
const { nextjsGenerator } = await import('./packages/generator-nextjs/dist/index.js');

// Read DSL source
const dslPath = resolve(__dirname, 'app.nova');
const dslSource = readFileSync(dslPath, 'utf-8');

console.log('\n🔭 Nova Compiler — Generating application...\n');
console.log(`   Source: ${dslPath}`);

const startTime = Date.now();

// Run the compiler with all generators
const result = await compile(
  dslSource,
  {
    projectName: 'nova-app',
    targetDirectory: resolve(__dirname, 'generated-app'),
    verbose: true,
  },
  [prismaGenerator, zodGenerator, nextjsGenerator],
);

// Report diagnostics
const errors = result.diagnostics.filter((d) => d.severity === 'error');
const warnings = result.diagnostics.filter((d) => d.severity === 'warning');

for (const diag of result.diagnostics) {
  const icon = diag.severity === 'error' ? '❌' : '⚠️';
  const location = diag.line ? ` (line ${diag.line}${diag.column ? `:${diag.column}` : ''})` : '';
  console.log(`   ${icon} ${diag.message}${location}`);
}

if (!result.success) {
  console.error(`\n❌ Compilation failed with ${errors.length} error(s).\n`);
  process.exit(1);
}

// Write artifacts to disk
const outputDir = resolve(__dirname, 'generated-app');
mkdirSync(outputDir, { recursive: true });

let fileCount = 0;
for (const artifact of result.artifacts) {
  const artifactPath = resolve(outputDir, artifact.path);
  mkdirSync(dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, artifact.content, 'utf-8');
  fileCount++;
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log(`\n✅ Generated successfully in ${elapsed}s`);
console.log(`   Output: ${outputDir}`);
console.log(`   Files: ${fileCount}`);
if (warnings.length > 0) {
  console.log(`   Warnings: ${warnings.length}`);
}
console.log('\nNext steps:');
console.log('  cd generated-app');
console.log('  npm install');
console.log('  npx prisma db push');
console.log('  npm run dev\n');
