// ---------------------------------------------------------------------------
// @nova/generator-prisma — Prisma Schema Generator
// ---------------------------------------------------------------------------
// Emits a complete schema.prisma file from the Nova AST.
// Handles models, enums, relations, indexes, and datasource configuration.

import type {
  ProgramNode,
  EntityNode,
  FieldNode,
  CompilerContext,
  GeneratedArtifact,
  Generator,
} from '@nova/compiler';

// ---------------------------------------------------------------------------
// Type Mapping: Nova DSL types → Prisma types
// ---------------------------------------------------------------------------
const NOVA_TO_PRISMA_TYPE: Record<string, string> = {
  string: 'String',
  number: 'Int',
  boolean: 'Boolean',
  date: 'DateTime',
  money: 'Decimal',
  uuid: 'String',
};

function mapType(field: FieldNode, knownEntities: Set<string>): string {
  if (field.relationTarget) {
    return field.relationTarget;
  }
  if (knownEntities.has(field.fieldType)) {
    return field.fieldType;
  }
  return NOVA_TO_PRISMA_TYPE[field.fieldType] ?? 'String';
}

// ---------------------------------------------------------------------------
// Model generation
// ---------------------------------------------------------------------------
function generateModel(entity: EntityNode, knownEntities: Set<string>): string {
  const lines: string[] = [];
  lines.push(`model ${entity.name} {`);

  // Fields
  for (const field of entity.fields) {
    const prismaType = mapType(field, knownEntities);
    const optionalMarker = field.isNullable ? '?' : '';
    const listMarker = field.isList ? '[]' : '';

    let fieldDef = `  ${field.name} ${prismaType}${optionalMarker}${listMarker}`;

    // Add @id for 'id' field
    if (field.name === 'id') {
      fieldDef += ' @id @default(uuid())';
    }

    // Add @unique for 'email' or 'slug' fields
    if (field.name === 'email' || field.name === 'slug') {
      fieldDef += ' @unique';
    }

    // Add @default(now()) for 'createdAt' or 'updatedAt'
    if (field.name === 'createdAt') {
      fieldDef += ' @default(now())';
    }
    if (field.name === 'updatedAt') {
      fieldDef += ' @updatedAt';
    }

    // Add relation annotation
    if (field.relationTarget) {
      const relationName = `${entity.name}_${field.name}_${field.relationTarget}`;
      fieldDef += ` @relation(name: "${relationName}", fields: [${field.name}Id], references: [id])`;
      // Add the foreign key field
      lines.push(fieldDef);
      lines.push(`  ${field.name}Id String`);
      continue;
    }

    lines.push(fieldDef);
  }

  // Add relation fields for entities that reference this entity
  // (handled by the @relation on the referencing side)

  // Add @@index for common query patterns
  const indexFields = entity.fields.filter(
    (f) => f.name === 'email' || f.name === 'slug' || f.name === 'createdAt',
  );
  if (indexFields.length > 0) {
    lines.push('');
    for (const idxField of indexFields) {
      lines.push(`  @@index([${idxField.name}])`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Enum generation
// ---------------------------------------------------------------------------
function generateEnum(name: string, values: readonly string[]): string {
  const lines: string[] = [];
  lines.push(`enum ${name} {`);
  for (const value of values) {
    lines.push(`  ${value}`);
  }
  lines.push('}');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Full schema generation
// ---------------------------------------------------------------------------
function generateSchema(
  program: ProgramNode,
  _context: CompilerContext,
): string {
  const knownEntities = new Set(
    program.declarations
      .filter((d): d is EntityNode => d.type === 'Entity')
      .map((e) => e.name),
  );

  const blocks: string[] = [];

  // Datasource
  blocks.push(`datasource db {`);
  blocks.push(`  provider = "postgresql"`);
  blocks.push(`  url      = env("DATABASE_URL")`);
  blocks.push('}');
  blocks.push('');

  // Generator
  blocks.push(`generator client {`);
  blocks.push(`  provider = "prisma-client-js"`);
  blocks.push('}');
  blocks.push('');

  // Enums
  blocks.push(generateEnum('Role', ['ADMIN', 'MEMBER', 'VIEWER']));
  blocks.push('');

  // Models
  for (const decl of program.declarations) {
    if (decl.type === 'Entity') {
      blocks.push(generateModel(decl, knownEntities));
      blocks.push('');
    }
  }

  return blocks.join('\n');
}

// ---------------------------------------------------------------------------
// Generator implementation
// ---------------------------------------------------------------------------
export const prismaGenerator: Generator = {
  name: 'prisma',

  async generate(
    program: ProgramNode,
    context: CompilerContext,
  ): Promise<GeneratedArtifact[]> {
    const schema = generateSchema(program, context);

    return [
      {
        path: 'prisma/schema.prisma',
        content: schema,
        type: 'file',
      },
    ];
  },
};

export default prismaGenerator;
