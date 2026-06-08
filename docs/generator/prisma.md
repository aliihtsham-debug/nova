# Prisma Generator Specification

## 1. Overview

The Prisma Generator (`@nova/generator-prisma`) consumes a validated `ProgramNode` AST and emits a `schema.prisma` file along with any required migration files. It translates DSL entity declarations, enums, and auth/billing models into Prisma ORM schema blocks.

### Responsibilities

- **Model generation** -- Converts every `EntityNode` in the DSL into a Prisma `model` block with properly typed fields, relations, indexes, and auto-managed timestamp fields.
- **Enum generation** -- Converts DSL `enum` declarations into Prisma `enum` blocks.
- **Relation generation** -- Emits `@relation` annotations with correct `fields` / `references` pairs for one-to-one, one-to-many, and many-to-many relationships.
- **Datasource configuration** -- Produces the `datasource db` block from the project's database configuration (PostgreSQL, MySQL, SQLite, or SQL Server).
- **Generator configuration** -- Produces the `generator client` block targeting the correct Prisma Client language.
- **Auth table injection** -- Conditionally includes authentication models (`User`, `Organization`, `Membership`, `Session`, `Account`) when the project declares an `auth` configuration.
- **Billing table injection** -- Conditionally includes billing models (`Subscription`, `Plan`, `UsageToken`) when the project declares a `billing` configuration.
- **Index generation** -- Emits `@@index`, `@@unique`, and `@@id` attributes based on field-level `unique`, `indexed`, and primary-key annotations in the DSL.

### Output

| File | Path | Description |
|------|------|-------------|
| `schema.prisma` | `<target>/prisma/schema.prisma` | Main Prisma schema with all models, enums, datasource, generator |
| `seed.ts` | `<target>/prisma/seed.ts` | Optional seed script for default roles and plans |

---

## 2. DSL-to-Prisma Type Mapping

Every field in a DSL `EntityNode` has a `type` property. The generator maps this property to a Prisma type using the following canonical table. When a type is unrecognized, the generator emits a diagnostic error and halts.

### Core Type Mapping Table

| DSL Type | Prisma Type | Notes |
|----------|-------------|-------|
| `string` | `String` | Plain text; mapped to `text` in most providers. |
| `number` | `Int` | Whole numbers. Use `Float` if fractional values needed. |
| `float` | `Float` | Mapped to `double precision` (PG), `double` (MySQL). |
| `boolean` | `Boolean` | true/false. |
| `date` | `DateTime` | ISO-8601 datetime. Also accepts `datetime`. |
| `money` | `Decimal` | Fixed-point for precision. Default: `@db.Decimal(19, 4)`. |
| `uuid` | `String` | Appended with `@default(uuid())` for auto-generation. |
| `json` | `Json` | Native JSON column; falls back to `String` on SQLite. |
| `bytes` | `Bytes` | Binary blob data. |
| `enum` | *(enum name)* | References a named Prisma `enum` block. |
| `relation` | *(related model name)* | Generates a relation field; see Section 4. |

### Optional and List Modifiers

| DSL Modifier | Prisma Output | Example |
|--------------|---------------|---------|
| `optional: true` | Append `?` to type | `String?` |
| `list: true` | Append `[]` to type | `String[]` |
| Both (optional + list) | `String[]` with warning | Prisma lists are nullable at DB level; `optional` is dropped with a warning. |

### Default Value Mapping

| DSL `default` | Prisma Output |
|---------------|---------------|
| `{ kind: "auto", fn: "uuid" }` | `@default(uuid())` |
| `{ kind: "auto", fn: "cuid" }` | `@default(cuid())` |
| `{ kind: "auto", fn: "now" }` | `@default(now())` |
| `{ kind: "auto", fn: "autoincrement" }` | `@default(autoincrement())` |
| `{ kind: "literal", value: <v> }` | `@default(<v>)` |
| `{ kind: "auto", fn: "nanoid" }` | `@default(nanoid())` |

### Database-Specific Type Overrides

| DSL Type | PostgreSQL | MySQL | SQLite | SQL Server |
|----------|------------|-------|--------|------------|
| `Json` | `jsonb` | `json` | `String` | `nvarchar(max)` |
| `Bytes` | `bytea` | `LongBlob` | `String` | `varbinary(max)` |
| `Decimal` | `numeric` | `decimal` | `Decimal` | `decimal` |

### Complete Mapping Example

```prisma
// DSL:
//   fields:
//     name:       { type: "string" }
//     age:        { type: "number" }
//     isActive:   { type: "boolean" }
//     registered: { type: "date" }
//     balance:    { type: "money" }
//     externalId: { type: "uuid" }
//     metadata:   { type: "json", optional: true }
//     role:       { type: "enum", enumName: "Role" }

model Example {
  name       String
  age        Int
  isActive   Boolean
  registered DateTime
  balance    Decimal     @db.Decimal(19, 4)
  externalId String      @default(uuid())
  metadata   Json?
  role       Role
}
```

---

## 3. Model Generation from EntityNode

Each top-level `EntityNode` in the DSL produces one `model` block in the output schema.

### 3.1 Auto-Fields

Every model receives three auto-managed fields **unless** the DSL entity explicitly sets `autoFields: false` in its configuration.

| Field | Type | Attributes | Purpose |
|-------|------|------------|---------|
| `id` | `String` | `@id @default(cuid())` | Primary identifier. |
| `createdAt` | `DateTime` | `@default(now())` | Timestamp of row creation. |
| `updatedAt` | `DateTime` | `@updatedAt` | Automatically updated on every write. |

These fields are **always prepended** before user-defined fields, even if not declared in the DSL.

#### Custom ID Type

The `idType` project config overrides the default CUID strategy:

| `idType` value | Generated `id` field |
|----------------|---------------------|
| `"cuid"` (default) | `id String @id @default(cuid())` |
| `"uuid"` | `id String @id @default(uuid())` |
| `"autoincrement"` | `id Int @id @default(autoincrement())` |

### 3.2 Field Emission Order

Fields are emitted in this order:

1. Auto-fields (`id`, `createdAt`, `updatedAt`)
2. User-defined scalar fields (alphabetical or declaration order, configurable)
3. Enum fields
4. Relation fields (including implicit foreign key fields)

### 3.3 EntityNode to Model Example

```prisma
// DSL EntityNode:
//   name: "Post"
//   fields:
//     title:     { type: "string" }
//     body:      { type: "string" }
//     published: { type: "boolean", default: { kind: "literal", value: false } }
//     author:    { type: "relation", target: "User", kind: "manyToOne" }

model Post {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  title     String
  body      String
  published Boolean  @default(false)

  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
}
```

### 3.4 Field Mapping Rules

1. **Nullable** -- If `field.isNullable === true`, the type gets `?` suffix: `String?`
2. **List** -- If `field.isList === true`, the type gets `[]` suffix: `String[]`
3. **Unique** -- If `field.isUnique === true`, append `@unique` to the field
4. **Default** -- If `field.default` is set, emit `@default(...)` using the default value mapping from Section 2.
5. **Relation** -- If `field.relationTarget` is set:
   - Adds a foreign key field: `<fieldName>Id String`
   - Adds `@relation` attribute: `@relation(fields: [<fieldName>Id], references: [id])`
   - The relation field itself stores the related model name: `<fieldName> <RelationTarget>`

### 3.5 Disabling Auto-Fields

```prisma
// DSL EntityNode:
//   name: "LegacyTable"
//   autoFields: false
//   fields:
//     legacyId: { type: "number", isId: true }
//     data:     { type: "string" }

model LegacyTable {
  legacyId Int    @id
  data     String
}
```

When `autoFields: false`, the generator does **not** inject `id`, `createdAt`, or `updatedAt`. The entity must declare its own primary key field with `isId: true`.

### 3.6 Custom Primary Keys

If a field in the DSL has `isId: true`, it replaces the auto-generated `id` field:

```prisma
// DSL:
//   fields:
//     email: { type: "string", isId: true }
//     name:  { type: "string" }

model Account {
  email     String   @id
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  name      String
}
```

### 3.7 Table Name Mapping

By default, the generator emits a `@@map` attribute with the snake_case table name:

```prisma
model UserProfile {
  // ...fields...
  @@map("user_profiles")
}
```

This is controlled by the `mapTables` generator config option (default: `true`). When disabled, Prisma uses the model name as-is for the table name.

---

## 4. Relations

The generator supports three relation kinds. Each `RelationNode` in the DSL produces the appropriate Prisma relation syntax.

### 4.1 Many-to-One (`manyToOne`)

The "many" side holds the foreign key. The generator adds an implicit foreign key field if not explicitly declared.

```prisma
// DSL: Post belongs to User (manyToOne)
model Post {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  title     String
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
}

model User {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  name      String
  posts     Post[]
}
```

**Rules:**
- The foreign key field (`<relationName>Id`) is auto-generated as `String` (matching the target's `id` type) unless the DSL provides an explicit scalar field for it.
- The `@relation` attribute is placed on the relation field, not the scalar foreign key.
- The inverse side (`posts Post[]`) is auto-generated on the target model unless the DSL provides an explicit `inverse` field.
- The "many-side" holds the `@relation` annotation and the foreign key column.
- The "one-side" only declares the array (list) field.

### 4.2 One-to-One (`oneToOne`)

```prisma
// DSL: User has one Profile (oneToOne)
model User {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  name      String
  profile   Profile?
}

model Profile {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  bio       String?
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
}
```

**Rules:**
- The foreign key is placed on the model that does **not** declare the `isId` side. By convention, the model declared second in the DSL holds the FK.
- A `@unique` constraint is added to the foreign key field to enforce the one-to-one cardinality.

### 4.3 Many-to-Many (`manyToMany`)

Prisma supports two forms: **implicit** (join table auto-created by Prisma) and **explicit** (developer controls the join table).

#### Implicit Many-to-Many

```prisma
// DSL: Post has many Tags, Tag has many Posts (manyToMany)
model Post {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  title     String
  tags      Tag[]
}

model Tag {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  name      String
  posts     Post[]
}
```

Prisma automatically creates a `_PostToTag` join table. No additional DSL is needed.

#### Explicit Many-to-Many

When the DSL declares an intermediate entity (e.g., `PostTag`), the generator produces two `manyToOne` relations instead:

```prisma
// DSL: PostTag joins Post and Tag
model PostTag {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  postId    String
  post      Post     @relation(fields: [postId], references: [id])
  tagId     String
  tag       Tag      @relation(fields: [tagId], references: [id])

  @@id([postId, tagId])
}
```

### 4.4 Cascade Delete

The `onDelete` policy is configurable per relation in the DSL. By default, cascade delete is enabled:

| DSL `onDelete` | Prisma Output |
|----------------|---------------|
| `Cascade` | `@relation(onDelete: Cascade)` |
| `Restrict` | `@relation(onDelete: Restrict)` |
| `SetNull` | `@relation(onDelete: SetNull)` |
| `SetDefault` | `@relation(onDelete: SetDefault)` |
| `NoAction` | `@relation(onDelete: NoAction)` |
| *(not set)* | `@relation(onDelete: Cascade)` (default) |

```prisma
// Explicit cascade delete (default behavior)
model Post {
  id       String @id @default(cuid())
  authorId String
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)
}
```

### 4.5 Self-Referential Relations

```prisma
// DSL: Employee with manager (self-referential manyToOne)
model Employee {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  name      String
  managerId String?
  manager   Employee? @relation("EmployeeManager", fields: [managerId], references: [id])
  reports   Employee[] @relation("EmployeeManager")
}
```

When a relation targets the same model, the generator **requires** a named `@relation("...")` to disambiguate both sides.

---

## 5. Enum Generation

DSL `enum` declarations map directly to Prisma `enum` blocks.

### 5.1 Basic Enum

```prisma
// DSL:
//   enums:
//     Role:
//       values: ["ADMIN", "MEMBER", "VIEWER"]

enum Role {
  ADMIN
  MEMBER
  VIEWER
}
```

### 5.2 Enum with Descriptions

If the DSL enum values carry `description` metadata, the generator emits Prisma triple-slash comments:

```prisma
// DSL:
//   enums:
//     OrderStatus:
//       values:
//         - name: "PENDING"
//           description: "Order received, awaiting processing"
//         - name: "SHIPPED"
//           description: "Order has been shipped"

enum OrderStatus {
  /// Order received, awaiting processing
  PENDING
  /// Order has been shipped
  SHIPPED
}
```

### 5.3 Enum Usage in Models

```prisma
model User {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  role      Role     @default(MEMBER)
}
```

### 5.4 Enum Ordering and Placement

Enums are always emitted **before** models so that models can reference them without forward-declaration issues.

### 5.5 Naming Convention

- Enum names are **PascalCase** in both DSL and Prisma output.
- Enum values are **UPPER_SNAKE_CASE**.
- If the DSL provides a camelCase or lowercase value, the generator converts it to UPPER_SNAKE_CASE and emits a warning.

---

## 6. Datasource and Generator Blocks

These two blocks appear **once** at the top of the `schema.prisma` file, before any model or enum definitions.

### 6.1 Datasource Block

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Always emitted as the **first block** in the schema.

#### Provider Configuration

| DSL `database.provider` | Prisma `provider` | Notes |
|-------------------------|-------------------|-------|
| `postgresql` | `"postgresql"` | Full type support including `Json`, `Bytes`. |
| `mysql` | `"mysql"` | `Bytes` maps to `LongBlob`. |
| `sqlite` | `"sqlite"` | `Json` falls back to `String`. `Bytes` falls back to `String`. |
| `sqlserver` | `"sqlserver"` | Requires preview features for some driver adapters. |
| `cockroachdb` | `"cockroachdb"` | Same capabilities as PostgreSQL. |

#### Optional Direct URL

If the project config specifies `directUrl`, it is added for connection-pooling setups:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}
```

#### Shadow Database

For migration workflows, a `shadowDatabaseUrl` can be specified:

```prisma
datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}
```

### 6.2 Generator Block

```prisma
generator client {
  provider = "prisma-client-js"
}
```

Always emitted as the **second block**, after `datasource`.

#### Client Language Mapping

| DSL `client.language` | Prisma `provider` value |
|-----------------------|-------------------------|
| `javascript` | `prisma-client-js` |
| `typescript` | `prisma-client-js` |
| `python` | `prisma-client-py` |
| `go` | `prisma-client-go` |
| `rust` | `prisma-client-rust` |

#### Preview Features

If the schema uses features that require preview flags, they are emitted:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "filteredRelationCount"]
}
```

#### Custom Output Path

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma-client"
}
```

#### Binary Targets (for serverless / edge)

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "windows", "debian-openssl-3.0.x"]
}
```

### 6.3 Full Header Example

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## 7. Index Generation Rules

The generator emits index attributes based on field-level and model-level annotations in the DSL.

### 7.1 Field-Level Indexes

| DSL Annotation | Prisma Output |
|----------------|---------------|
| `isId: true` | `@id` -- implicitly unique and indexed; no additional index needed. |
| `isUnique: true` | `@unique` appended to the field line. |
| `isIndexed: true` | No inline attribute; a `@@index` is added at the model level. |

### 7.2 Auto-Generated Indexes

The following indexes are auto-generated even without explicit DSL annotations:

- **All foreign key fields**: `@@index([authorId])` per model
- **All `@unique` fields**: the `@unique` attribute itself is sufficient (Prisma creates the index automatically)
- **Compound indexes** for frequently queried field combinations (if declared in the DSL)

### 7.3 Model-Level `@@index`

When one or more fields have `isIndexed: true`, the generator collects them and emits `@@index` blocks:

```prisma
// DSL:
//   fields:
//     email:    { type: "string", isUnique: true }
//     lastName: { type: "string", isIndexed: true }
//     firstName: { type: "string", isIndexed: true }

model User {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  email     String   @unique
  firstName String
  lastName  String

  @@index([lastName, firstName])
}
```

### 7.4 Composite Unique Constraints (`@@unique`)

```prisma
// DSL:
//   unique:
//     - ["orgId", "email"]
//     - ["orgId", "slug"]

model User {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orgId     String
  email     String
  slug      String

  @@unique([orgId, email])
  @@unique([orgId, slug])
}
```

### 7.5 Composite Primary Keys (`@@id`)

```prisma
// DSL:
//   fields:
//     orgId:  { type: "string", isId: true }
//     userId: { type: "string", isId: true }

model Membership {
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orgId     String
  userId    String

  @@id([orgId, userId])
}
```

### 7.6 Full-Text Index (PostgreSQL)

If `fullTextIndex: true` is set on a string field and the datasource is PostgreSQL:

```prisma
model Article {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  title     String
  body      String

  @@fulltext([title, body])
}
```

### 7.7 Index Ordering and Sorting

The DSL supports per-field sort direction in composite indexes:

```prisma
// DSL:
//   indexes:
//     - fields: ["lastName", { field: "createdAt", sort: "desc" }]

@@index([lastName, createdAt(sort: Desc)])
```

---

## 8. Auth Tables (Conditional)

When the compiler detects that auth is needed (via CLI flag `--auth` or DSL auth declarations), the generator injects the following models. These implement a complete authentication and authorization system supporting multi-tenancy, session management, and OAuth account linking.

### 8.1 Activation Condition

```yaml
# DSL project config
auth:
  provider: "credentials"   # or "oauth", "magic-link"
  organizations: true       # enables Organization + Membership
```

Auth models are generated **only** when `auth` is present in the project config. The `organizations` flag controls whether `Organization` and `Membership` are included.

### 8.2 User Model

```prisma
model User {
  id             String    @id @default(cuid())
  name           String?
  email          String?   @unique
  emailVerified  DateTime?
  image          String?
  hashedPassword String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  accounts       Account[]
  sessions       Session[]
  memberships    Membership[]   // Only if auth.organizations == true

  @@map("users")
}
```

**Field details:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` | CUID primary key (or UUID via config). |
| `name` | `String?` | Display name; nullable for OAuth-only users. |
| `email` | `String?` | Unique login identifier; nullable if using OAuth without email. |
| `emailVerified` | `DateTime?` | Set when email verification is completed. |
| `image` | `String?` | Avatar URL. |
| `hashedPassword` | `String?` | Bcrypt/argon2 hash; null for passwordless/OAuth users. |

### 8.3 Account Model

Stores OAuth provider credentials for linked accounts.

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}
```

### 8.4 Session Model

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}
```

### 8.5 Organization Model

Generated only when `auth.organizations: true`.

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members   Membership[]

  @@map("organizations")
}
```

### 8.6 Membership Model

Represents the join between `User` and `Organization` with a role.

```prisma
model Membership {
  id   String @id @default(cuid())
  role Role   @default(MEMBER)

  userId String
  orgId  String

  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  org  Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([userId, orgId])
  @@map("memberships")
}
```

### 8.7 VerificationToken Model

```prisma
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}
```

### 8.8 Auth Enum

```prisma
enum Role {
  ADMIN
  MEMBER
  VIEWER
}
```

### 8.9 Auth-Only Schema Example

When `auth` is declared without any custom entities, the generated schema contains only the auth models:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  MEMBER
  VIEWER
}

model User {
  id             String    @id @default(cuid())
  name           String?
  email          String?   @unique
  emailVerified  DateTime?
  image          String?
  hashedPassword String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime @updatedAt
  accounts       Account[]
  sessions       Session[]
  memberships    Membership[]
  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("sessions")
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  members   Membership[]
  @@map("organizations")
}

model Membership {
  id   String @id @default(cuid())
  role Role   @default(MEMBER)
  userId String
  orgId  String
  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  org  Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  @@unique([userId, orgId])
  @@map("memberships")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
  @@map("verification_tokens")
}
```

---

## 9. Billing Tables (Conditional)

When billing is requested (via CLI flag `--billing` or DSL billing declarations), the generator injects subscription and usage-tracking models.

### 9.1 Activation Condition

```yaml
# DSL project config
billing:
  provider: "stripe"       # or "lemonsqueezy", "paddle"
  plans:
    - name: "free"
      priceMonthly: 0
      priceYearly: 0
    - name: "pro"
      priceMonthly: 29
      priceYearly: 290
    - name: "enterprise"
      priceMonthly: 99
      priceYearly: 990
```

Billing models are generated **only** when `billing` is present in the project config.

### 9.2 Plan Model

```prisma
model Plan {
  id              String   @id @default(cuid())
  name            String   @unique
  slug            String   @unique
  description     String?
  priceMonthly    Decimal  @db.Decimal(19, 4)
  priceYearly     Decimal  @db.Decimal(19, 4)
  currency        String   @default("USD")
  stripeProductId String?  @unique
  stripePriceMonthlyId String? @unique
  stripePriceYearlyId  String? @unique
  features        Json?
  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  subscriptions   Subscription[]

  @@map("plans")
}
```

**Field details:**

| Field | Type | Notes |
|-------|------|-------|
| `name` | `String` | Human-readable plan name (e.g., "Pro"). |
| `slug` | `String` | URL-safe identifier (e.g., "pro"). |
| `priceMonthly` | `Decimal` | Monthly price. |
| `priceYearly` | `Decimal` | Annual price. |
| `currency` | `String` | ISO 4217 currency code. Default: `"USD"`. |
| `stripeProductId` | `String?` | Stripe product ID for API reconciliation. |
| `stripePriceMonthlyId` | `String?` | Stripe price object ID for the monthly tier. |
| `stripePriceYearlyId` | `String?` | Stripe price object ID for the annual tier. |
| `features` | `Json?` | Feature flags or limits (e.g., `{ "maxProjects": 10 }`). |
| `isActive` | `Boolean` | Whether the plan is available for new subscriptions. |
| `sortOrder` | `Int` | Display ordering in plan comparison UI. |

### 9.3 Subscription Model

```prisma
model Subscription {
  id                   String             @id @default(cuid())
  status               SubscriptionStatus
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean            @default(false)
  canceledAt           DateTime?
  trialStart           DateTime?
  trialEnd             DateTime?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  userId               String
  planId               String

  user                 User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan                 Plan               @relation(fields: [planId], references: [id])

  stripeSubscriptionId String?            @unique
  stripeCustomerId     String?

  usageTokens          UsageToken[]

  @@index([userId])
  @@index([status])
  @@map("subscriptions")
}
```

**Subscription status lifecycle:**

```
INCOMPLETE -> ACTIVE -> PAST_DUE -> CANCELED
                |            |
                v            v
            TRIALING    UNPAID
                |
                v
             ACTIVE
```

### 9.4 UsageToken Model

Tracks metered usage for usage-based billing components.

```prisma
model UsageToken {
  id        String   @id @default(cuid())
  action    String
  metadata  Json?
  userId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, action, createdAt])
  @@map("usage_tokens")
}
```

**Field details:**

| Field | Type | Notes |
|-------|------|-------|
| `action` | `String` | The metered feature being tracked (e.g., `"api_calls"`, `"storage_gb"`). |
| `metadata` | `Json?` | Arbitrary context (e.g., `{ "region": "us-east-1" }`). |
| `userId` | `String` | Reference to the consuming user. |

### 9.5 Billing Enums

```prisma
enum Interval {
  MONTH
  YEAR
}

enum SubscriptionStatus {
  INCOMPLETE
  INCOMPLETE_EXPIRED
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
  UNPAID
  PAUSED
}
```

### 9.6 Billing + Auth Combined

When both `auth` and `billing` are declared, the `User` model gains a `subscriptions` relation:

```prisma
model User {
  id             String    @id @default(cuid())
  name           String?
  email          String?   @unique
  emailVerified  DateTime?
  image          String?
  hashedPassword String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime @updatedAt

  accounts       Account[]
  sessions       Session[]
  memberships    Membership[]
  subscriptions  Subscription[]   // Added by billing module

  @@map("users")
}
```

### 9.7 Billing-Only Schema (No Auth)

If billing is declared without auth, the generator creates a minimal `User` model sufficient to anchor subscriptions:

```prisma
model User {
  id             String    @id @default(cuid())
  email          String?   @unique
  hashedPassword String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime @updatedAt

  subscriptions  Subscription[]
}
```

---

## 10. File Emission Order

The `schema.prisma` file is assembled in this strict order:

1. `generator client` block
2. `datasource db` block
3. Enums (auth Role, billing Interval/SubscriptionStatus, user-defined enums)
4. Auth models (`User`, `Account`, `Session`, `Organization`, `Membership`, `VerificationToken`)
5. Billing models (`Plan`, `Subscription`, `UsageToken`)
6. User entity models (from `EntityNode` declarations, in dependency order)
7. Relation `@@index` declarations at end of each model

---

## 11. Post-Processing

After emitting the schema file, the generator runs:

1. **`prisma format`** -- Auto-formats the generated `schema.prisma` for consistent style.
2. **`prisma generate`** -- Generates the Prisma Client based on the schema. This is also wired into the project's `postinstall` script for subsequent installs.

---

## Appendix A: Complete Generated Schema Example

The following is a full example combining all sections -- custom entities, auth, billing, enums, and relations:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// -- Enums -------------------------------------------

enum Role {
  ADMIN
  MEMBER
  VIEWER
}

enum Interval {
  MONTH
  YEAR
}

enum SubscriptionStatus {
  INCOMPLETE
  INCOMPLETE_EXPIRED
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
  UNPAID
  PAUSED
}

// -- Auth Models -------------------------------------

model User {
  id             String    @id @default(cuid())
  name           String?
  email          String?   @unique
  emailVerified  DateTime?
  image          String?
  hashedPassword String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime @updatedAt
  accounts       Account[]
  sessions       Session[]
  memberships    Membership[]
  subscriptions  Subscription[]
  posts          Post[]
  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("sessions")
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  members   Membership[]
  @@map("organizations")
}

model Membership {
  id   String @id @default(cuid())
  role Role   @default(MEMBER)
  userId String
  orgId  String
  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  org  Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  @@unique([userId, orgId])
  @@map("memberships")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
  @@map("verification_tokens")
}

// -- Billing Models ----------------------------------

model Plan {
  id              String   @id @default(cuid())
  name            String   @unique
  slug            String   @unique
  description     String?
  priceMonthly    Decimal  @db.Decimal(19, 4)
  priceYearly     Decimal  @db.Decimal(19, 4)
  currency        String   @default("USD")
  stripeProductId String?  @unique
  stripePriceMonthlyId String? @unique
  stripePriceYearlyId  String? @unique
  features        Json?
  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  subscriptions   Subscription[]
  @@map("plans")
}

model Subscription {
  id                   String             @id @default(cuid())
  status               SubscriptionStatus
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean            @default(false)
  canceledAt           DateTime?
  trialStart           DateTime?
  trialEnd             DateTime?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
  userId               String
  planId               String
  user                 User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan                 Plan               @relation(fields: [planId], references: [id])
  stripeSubscriptionId String?            @unique
  stripeCustomerId     String?
  usageTokens          UsageToken[]
  @@index([userId])
  @@index([status])
  @@map("subscriptions")
}

model UsageToken {
  id        String   @id @default(cuid())
  action    String
  metadata  Json?
  userId    String
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, action, createdAt])
  @@map("usage_tokens")
}

// -- Application Models ------------------------------

model Post {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  title       String
  slug        String   @unique
  body        String
  published   Boolean  @default(false)
  viewCount   Int      @default(0)
  rating      Float?
  publishedAt DateTime?
  authorId    String
  author      User     @relation(fields: [authorId], references: [id])
  tags        Tag[]
  @@index([authorId])
  @@index([published, publishedAt])
  @@fulltext([title, body])
}

model Tag {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  name      String   @unique
  posts     Post[]
}
```

---

## Appendix B: Generator Configuration Reference

All generator options available in the DSL `generator.prisma` configuration block:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `string` | `"postgresql"` | Database provider. |
| `clientLanguage` | `string` | `"typescript"` | Target Prisma Client language. |
| `idType` | `"cuid" \| "uuid" \| "autoincrement"` | `"cuid"` | Primary key generation strategy. |
| `fieldOrder` | `"declaration" \| "alphabetical"` | `"declaration"` | Order of fields in generated models. |
| `autoFields` | `boolean` | `true` | Inject `id`, `createdAt`, `updatedAt`. |
| `mapTables` | `boolean` | `true` | Emit `@@map()` attributes using snake_case table names. |
| `headerComments` | `boolean` | `true` | Emit `//` comments separating sections. |
| `previewFeatures` | `string[]` | `[]` | Prisma preview feature flags. |
| `binaryTargets` | `string[]` | `["native"]` | Binary targets for Prisma Client. |
