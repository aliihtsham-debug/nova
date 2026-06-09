import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const packages = [
  'parser',
  'compiler',
  'generator-prisma',
  'generator-zod',
  'generator-nextjs',
  'openrouter',
  'lsp',
  'create-nova',
];

const cwd = 'E:\\NOVA';
const results = [];

for (const pkg of packages) {
  const dir = resolve(cwd, `packages/${pkg}`);
  console.log(`\n--- Publishing @aliihtsham-debug/${pkg} ---`);
  try {
    const output = execSync('cmd /c "npm publish --access public"', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
      env: { ...process.env, npm_config_loglevel: 'notice' },
    });
    const line = output.split('\n').find((l) => l.startsWith('+ '));
    console.log(`  OK: ${line}`);
    results.push({ pkg, status: 'ok', line });
  } catch (e) {
    const out = [e.stdout || '', e.stderr || '', e.message].join('\n');
    const line = out.split('\n').find((l) => l.includes('error') || l.includes('+ ')) || out.slice(0, 200);
    console.log(`  ERR: ${line}`);
    results.push({ pkg, status: 'err', line });
  }
}

console.log('\n=== Summary ===');
for (const r of results) {
  console.log(`  ${r.status === 'ok' ? '+' : 'x'} @aliihtsham-debug/${r.pkg}: ${r.line}`);
}
