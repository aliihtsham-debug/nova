import { execSync } from 'node:child_process';

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

const results = [];

for (const pkg of packages) {
  const dir = `/e/NOVA/packages/${pkg}`;
  console.log(`\n--- Publishing @aliihtsham-debug/${pkg} ---`);
  try {
    const output = execSync('npm publish --access public', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,
      env: { ...process.env, npm_config_loglevel: 'notice' },
    });
    const line = output.split('\n').find((l) => l.startsWith('+ '));
    console.log(`  OK: ${line}`);
    results.push({ pkg, status: 'ok', line });
  } catch (e) {
    const msg = e.stderr?.toString() || e.message;
    const line = msg.split('\n').find((l) => l.includes('error') || l.includes('+ ')) || msg.slice(0, 200);
    console.log(`  ERR: ${line}`);
    results.push({ pkg, status: 'err', line });
  }
}

console.log('\n=== Summary ===');
for (const r of results) {
  console.log(`  ${r.status === 'ok' ? '+' : 'x'} @aliihtsham-debug/${r.pkg}: ${r.line}`);
}
