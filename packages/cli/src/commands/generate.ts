import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { compile } from '@nova/compiler';
import { prismaGenerator } from '@nova/generator-prisma';
import { zodGenerator } from '@nova/generator-zod';
import { nextjsGenerator } from '@nova/generator-nextjs';

interface GenerateOptions {
  file: string;
  output: string;
  auth: boolean;
  billing: boolean;
  force: boolean;
  format: boolean;
}

/**
 * Generate a Next.js application from a .nova DSL file.
 */
export async function generateCommand(options: GenerateOptions): Promise<void> {
  const { file, output, force, auth, billing, format } = options;

  // Validate DSL file exists
  const dslPath = path.resolve(file);
  if (!fs.existsSync(dslPath)) {
    console.error(chalk.red(`✖ DSL file not found: ${dslPath}`));
    process.exit(2);
  }

  const outputDir = path.resolve(output);

  // Check output directory
  if (fs.existsSync(outputDir) && !force) {
    const files = fs.readdirSync(outputDir);
    if (files.length > 0) {
      console.error(
        chalk.red(`✖ Output directory '${output}' is not empty. Use --force to overwrite.`),
      );
      process.exit(1);
    }
  }

  // Read DSL source
  const dslSource = fs.readFileSync(dslPath, 'utf-8');
  const projectName = path.basename(outputDir);

  console.log(chalk.blue(`\n◴ Compiling ${file}...\n`));

  const startTime = Date.now();

  // Phase 1-6: Compile (lex → parse → analyze → validate → generate)
  // Wire all three generators into the compilation pipeline
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

  // Report diagnostics
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  const warnings = result.diagnostics.filter((d) => d.severity === 'warning');

  for (const diagnostic of result.diagnostics) {
    const prefix = diagnostic.severity === 'error' ? chalk.red('✖') : chalk.yellow('⚠');
    const location =
      diagnostic.line !== undefined
        ? chalk.gray(` (line ${diagnostic.line}${diagnostic.column !== undefined ? `:${diagnostic.column}` : ''})`)
        : '';
    console.log(`  ${prefix} ${diagnostic.message}${location}`);
    if (diagnostic.code) {
      console.log(chalk.gray(`    Code: ${diagnostic.code}`));
    }
  }

  if (!result.success) {
    console.error(chalk.red(`\n✖ Compilation failed with ${errors.length} error(s).\n`));
    // Match the compiler's actual error code prefixes:
    //   DUPLICATE_DECLARATION, DUPLICATE_FIELD, UNKNOWN_RELATION_TARGET,
    //   UNKNOWN_ENTITY_REF, CIRCULAR_RELATION, EMPTY_ENTITY, etc.
    if (errors.some((e) => e.code?.startsWith('DUPLICATE_') || e.code?.startsWith('UNKNOWN_') || e.code === 'CIRCULAR_RELATION')) {
      process.exit(3); // semantic error
    }
    process.exit(2); // default to parse/general compilation error
  }

  // Write artifacts to disk
  fs.mkdirSync(outputDir, { recursive: true });

  let prismaGenerated = false;
  for (const artifact of result.artifacts) {
    const artifactPath = path.join(outputDir, artifact.path);

    if (artifact.type === 'directory') {
      fs.mkdirSync(artifactPath, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(artifactPath), { recursive: true });

      let content = artifact.content;

      // Optionally format generated TypeScript/JavaScript files with Prettier
      if (format && /\.(ts|tsx|js|jsx)$/.test(artifact.path)) {
        try {
          const prettier = await import('prettier');
          const formatted = await prettier.format(content, {
            parser: artifact.path.endsWith('.tsx') ? 'typescript' : 'typescript',
            singleQuote: true,
            trailingComma: 'all',
          });
          content = formatted;
        } catch {
          // If formatting fails, use the unformatted content
        }
      }

      fs.writeFileSync(artifactPath, content, 'utf-8');

      if (artifact.path === 'prisma/schema.prisma') {
        prismaGenerated = true;
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(chalk.green(`\n✔ Generated successfully in ${elapsed}s`));
  console.log(chalk.gray(`  Output: ${outputDir}`));
  console.log(chalk.gray(`  Files: ${result.artifacts.length}`));

  if (warnings.length > 0) {
    console.log(chalk.yellow(`  Warnings: ${warnings.length}`));
  }

  console.log(chalk.white('\nNext steps:'));
  console.log(chalk.gray(`  cd ${output}`));
  console.log(chalk.gray('  npm install'));
  if (prismaGenerated) {
    console.log(chalk.gray('  npx prisma db push'));
  }
  console.log(chalk.gray('  npm run dev'));
  console.log('');
}
