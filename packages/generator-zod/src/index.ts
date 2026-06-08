// ---------------------------------------------------------------------------
// @nova/generator-zod — Zod Validation Schema Generator
// ---------------------------------------------------------------------------
// Emits Zod validation schemas for every entity in the AST.
// Produces both Create and Update schema variants.

import type {
  ProgramNode,
  EntityNode,
  FieldNode,
  CompilerContext,
  GeneratedArtifact,
  Generator,
} from '@nova/compiler';

// ---------------------------------------------------------------------------
// Type Mapping: Nova DSL types → Zod validators
// ---------------------------------------------------------------------------
function fieldToZod(field: FieldNode, knownEntities: Set<string>): string {
  const { name, fieldType, isNullable, isList, relationTarget } = field;

  // Relation fields use string UUID validation
  if (relationTarget || knownEntities.has(fieldType)) {
    let validator = 'z.string().uuid()';
    if (isList) validator = `z.array(${validator})`;
    if (isNullable) validator = `${validator}.nullable()`;
    return `  ${name}: ${validator}`;
  }

  let validator: string;

  switch (fieldType) {
    case 'string':
      validator = 'z.string()';
      // Add email validation for email fields
      if (name === 'email') {
        validator += '.email()';
      }
      // Add min/max for name fields
      if (name === 'name' || name === 'title') {
        validator += '.min(1).max(255)';
      }
      break;
    case 'number':
      validator = 'z.number()';
      if (name === 'age' || name === 'quantity' || name === 'count') {
        validator += '.int().nonnegative()';
      }
      break;
    case 'boolean':
      validator = 'z.boolean()';
      break;
    case 'date':
      validator = 'z.coerce.date()';
      break;
    case 'money':
      validator = 'z.number().nonnegative()';
      break;
    case 'uuid':
      validator = 'z.string().uuid()';
      break;
    default:
      validator = 'z.string()';
  }

  if (isList) {
    validator = `z.array(${validator})`;
  }

  if (isNullable) {
    validator = `${validator}.nullable()`;
  }

  // id, createdAt, updatedAt are optional on create (auto-generated)
  if (name === 'id' || name === 'createdAt' || name === 'updatedAt') {
    validator = `${validator}.optional()`;
  }

  return `  ${name}: ${validator}`;
}

// ---------------------------------------------------------------------------
// Schema generation
// ---------------------------------------------------------------------------
function generateCreateSchema(entity: EntityNode, knownEntities: Set<string>): string {
  const lines: string[] = [];
  lines.push(`import { z } from 'zod';`);
  lines.push('');
  lines.push(`export const create${entity.name}Schema = z.object({`);

  for (const field of entity.fields) {
    lines.push(fieldToZod(field, knownEntities));
  }

  lines.push('});');
  lines.push('');
  lines.push(`export type Create${entity.name}Input = z.infer<typeof create${entity.name}Schema>;`);

  return lines.join('\n');
}

function generateUpdateSchema(entity: EntityNode, knownEntities: Set<string>): string {
  const lines: string[] = [];
  lines.push(`import { z } from 'zod';`);
  lines.push('');
  lines.push(`export const update${entity.name}Schema = z.object({`);

  for (const field of entity.fields) {
    // All fields optional on update
    const fieldDef = fieldToZod(
      { ...field, isNullable: true },
      knownEntities,
    );
    lines.push(fieldDef);
  }

  lines.push('}).partial();');
  lines.push('');
  lines.push(`export type Update${entity.name}Input = z.infer<typeof update${entity.name}Schema>;`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Generator implementation
// ---------------------------------------------------------------------------
export const zodGenerator: Generator = {
  name: 'zod',

  async generate(
    program: ProgramNode,
    _context: CompilerContext,
  ): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];
    const knownEntities = new Set(
      program.declarations
        .filter((d): d is EntityNode => d.type === 'Entity')
        .map((e) => e.name),
    );

    for (const decl of program.declarations) {
      if (decl.type !== 'Entity') continue;

      const createSchema = generateCreateSchema(decl, knownEntities);
      const updateSchema = generateUpdateSchema(decl, knownEntities);

      artifacts.push({
        path: `src/lib/validations/${decl.name.toLowerCase()}.ts`,
        content: createSchema + '\n\n' + updateSchema,
        type: 'file',
      });
    }

    return artifacts;
  },
};

export default zodGenerator;
