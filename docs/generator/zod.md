# Zod Generator Specification

## 1. Overview

The Zod Generator is a code-generation module that reads application entity definitions (the DSL) and produces fully-typed Zod validation schemas in TypeScript. These schemas serve as the runtime validation boundary for every API request and response, ensuring that data conforms to the domain model before it reaches business logic.

### Purpose

- **Single source of truth**: Entity definitions in the DSL drive both database schema (via Prisma or similar) and API validation (via Zod). There is no divergence between what the database expects and what the API accepts.
- **Type safety**: Every generated Zod schema exports an inferred TypeScript type, so consumers get both runtime validation and compile-time type checking from a single definition.
- **Convention over creation**: The generator enforces consistent patterns -- Create vs. Update schemas, nullable handling, relation foreign keys, enum validation -- so that hand-written boilerplate is never needed.

### Output Location

All generated schemas are placed under:

```
lib/schemas/
```

Each entity gets its own file named `[EntityName]Schema.ts`, and an `index.ts` barrel file re-exports every schema and inferred type from a single entry point.

---

## 2. Complete DSL-to-Zod Type Mapping

Every field in an entity definition has a DSL type. The generator translates each DSL type into the corresponding Zod chain. The full mapping table follows.

| DSL Type       | Zod Expression                                | Notes                                        |
| -------------- | --------------------------------------------- | -------------------------------------------- |
| `string`       | `z.string()`                                  | UTF-8 text, any length                       |
| `number`       | `z.number()`                                  | Any finite number (integer or float)         |
| `boolean`      | `z.boolean()`                                 | `true` or `false`                            |
| `date`         | `z.date()`                                    | JavaScript `Date` object                     |
| `money`        | `z.number().positive()`                       | Non-negative number (currency minor units)  |
| `uuid`         | `z.string().uuid()`                           | RFC 4122 UUID string                         |
| `email`        | `z.string().email()`                          | Validated email address string               |
| `url`          | `z.string().url()`                            | Validated URL string                         |
| `enum`         | `z.enum([...])`                               | See Section 7                                |
| `relation`     | `z.string()`                                  | See Section 6                                |
| `json`         | `z.record(z.string(), z.unknown())`           | Arbitrary key-value object                   |
| `string[]`     | `z.array(z.string())`                         | Array of strings                             |
| `number[]`     | `z.array(z.number())`                         | Array of numbers                             |

### Code Example: Simple Entity

Given the following DSL entity:

```yaml
entity: User
fields:
  name: string
  email: email
  age: number
  isActive: boolean
  registeredAt: date
```

The generator produces:

```typescript
import { z } from "zod";

export const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number(),
  isActive: z.boolean(),
  registeredAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;
```

---

## 3. CreateSchema Generation

Every entity produces a `Create[EntityName]Schema` used to validate incoming request payloads for create operations.

### Rules

1. **All declared fields are required** unless explicitly marked as `optional` in the DSL.
2. **Auto-generated fields are excluded**: The fields `id`, `createdAt`, and `updatedAt` are never included in the CreateSchema. These are owned by the database/service layer, not supplied by the caller.
3. **Default values in the DSL** are translated into `.default()` calls on the Zod chain.

### Example

```yaml
entity: Product
fields:
  id: uuid
  name: string
  price: money
  description: string, optional
  createdAt: date
  updatedAt: date
```

Generated output:

```typescript
export const CreateProductSchema = z.object({
  name: z.string(),
  price: z.number().positive(),
  description: z.string().optional(),
  // id is excluded
  // createdAt is excluded
  // updatedAt is excluded
});

export type CreateProduct = z.infer<typeof CreateProductSchema>;
```

Note that:
- `id` is stripped even though it is defined in the DSL.
- `createdAt` and `updatedAt` are stripped for the same reason.
- `description` is optional and remains optional in the schema.
- `price` maps to `z.number().positive()` per the `money` DSL type.

---

## 4. UpdateSchema Generation

Every entity produces an `Update[EntityName]Schema` used to validate incoming request payloads for update (PATCH/PUT) operations.

### Rules

1. **All fields are made optional** by applying Zod's `.partial()` to the base schema. The caller may supply any subset of fields.
2. **Auto-generated fields are excluded** from the partial, same as CreateSchema: `id`, `createdAt`, `updatedAt` are never present.
3. **The id field is added back** as a required `z.string()` at the top level so the service layer knows which record to update.

### Example

Using the same `Product` entity:

```typescript
export const UpdateProductSchema = z.object({
  id: z.string(),
}).merge(CreateProductSchema.partial());

export type UpdateProduct = z.infer<typeof UpdateProductSchema>;
```

This produces a schema where:
- `id` is required (the record to update).
- `name`, `price`, and `description` are all optional (only supply what changed).
- `createdAt` and `updatedAt` are never exposed.

---

## 5. Nullable Fields

The DSL supports nullable fields using the `?` suffix or an explicit `nullable: true` property. The generator distinguishes between **nullable** and **optional**, which are semantically different.

| DSL Syntax            | Meaning                               | Zod Output              |
| --------------------- | ------------------------------------- | ----------------------- |
| `field: string`       | Required, non-nullable                | `z.string()`            |
| `field: string?`      | Required, nullable                    | `z.string().nullable()` |
| `field: string, optional` | Optional, non-nullable            | `z.string().optional()` |
| `field: string?, optional` | Optional and nullable            | `z.string().optional().nullable()` |

### Semantics

- **Nullable** means the field must be present in the object but its value may be `null`. Use `.nullable()`.
- **Optional** means the field may be omitted entirely from the object. Use `.optional()`.
- **Optional and nullable** means the field may be omitted, and if present, may be `null`. Chain both: `.optional().nullable()`. The order matters -- `.optional().nullable()` is correct; `.nullable().optional()` produces a different (usually unintended) type.

### Example

```yaml
entity: Employee
fields:
  name: string
  managerId: string?
  department: string, optional
  endDate: date?, optional
```

Generated:

```typescript
export const EmployeeSchema = z.object({
  name: z.string(),
  managerId: z.string().nullable(),         // must be present, can be null
  department: z.string().optional(),        // may be omitted entirely
  endDate: z.date().optional().nullable(),  // may be omitted, and may be null
});
```

---

## 6. Relation Fields

When an entity declares a relation to another entity, the generator does **not** embed the related entity's full schema. Instead, the relation field becomes a simple `z.string()` representing the foreign key ID.

### Rules

1. **BelongsTo / HasOne relations**: The foreign key field (e.g., `organizationId`) is emitted as `z.string()`.
2. **HasMany relations**: These are **not** included in the schema because nested arrays of full objects are not typically accepted in create/update payloads. If needed, a separate input schema is generated.
3. **The relation metadata** (entity name, foreign key name) is stored in a JSDoc comment and an exported `relations` map for runtime introspection by middleware.

### Example

```yaml
entity: Project
fields:
  name: string
  ownerId: relation Owner
  organizationId: relation Organization
  status: enum [active, archived, draft]
```

Generated:

```typescript
export const ProjectSchema = z.object({
  name: z.string(),
  /** Foreign key reference to Owner */
  ownerId: z.string(),
  /** Foreign key reference to Organization */
  organizationId: z.string(),
  status: z.enum(["active", "archived", "draft"]),
});

/** Runtime relation metadata for middleware */
export const ProjectRelations = {
  ownerId: { entity: "Owner", field: "ownerId" },
  organizationId: { entity: "Organization", field: "organizationId" },
} as const;
```

---

## 7. Enum Fields

When a field is declared as an `enum` in the DSL, the generator emits a `z.enum()` validator with the allowed literal values.

### Rules

1. **Enum values are string literals** in the current version. Numeric enums are not generated.
2. **The enum name** is inferred from the field name (PascalCase + "Enum") and exported alongside the schema.
3. **Enum values are validated literally**: `z.enum(["active", "archived"])` will reject any value not in the list.

### Example

```yaml
entity: Order
fields:
  status: enum [pending, confirmed, shipped, delivered, cancelled]
  priority: enum [low, medium, high]
```

Generated:

```typescript
export const OrderStatusEnum = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
export const OrderPriorityEnum = ["low", "medium", "high"] as const;

export const OrderSchema = z.object({
  status: z.enum(OrderStatusEnum),
  priority: z.enum(OrderPriorityEnum),
});

export type Order = z.infer<typeof OrderSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderPriority = z.infer<typeof OrderPrioritySchema>;
```

---

## 8. File Naming Convention

### Schema Files

Each entity produces exactly one file:

```
lib/schemas/[EntityName]Schema.ts
```

| Entity Name   | File Path                          |
| ------------- | ---------------------------------- |
| `User`        | `lib/schemas/UserSchema.ts`        |
| `Product`     | `lib/schemas/ProductSchema.ts`     |
| `OrderItem`   | `lib/schemas/OrderItemSchema.ts`   |

- File names are **PascalCase** matching the entity name exactly.
- The suffix `Schema` is always appended.
- The extension is always `.ts`.

### Index Barrel File

All schemas are re-exported from a single barrel:

```
lib/schemas/index.ts
```

See Section 9 for the barrel structure.

---

## 9. Export Structure and Index Barrel File

### Per-File Exports

Each `[EntityName]Schema.ts` file exports the following symbols:

| Export                        | Kind      | Description                                    |
| ----------------------------- | --------- | ---------------------------------------------- |
| `[EntityName]Schema`          | `z.ZodObject` | Full entity schema (all fields, required)      |
| `[EntityName]`                | `type`    | Inferred TypeScript type from the full schema   |
| `Create[EntityName]Schema`    | `z.ZodObject` | Schema for create mutations (no auto fields)    |
| `Create[EntityName]`          | `type`    | Inferred type for create payloads              |
| `Update[EntityName]Schema`    | `z.ZodObject` | Schema for update mutations (all partial + id) |
| `Update[EntityName]`          | `type`    | Inferred type for update payloads              |
| `[FieldName]Enum`             | `readonly string[]` | Only for enum fields; the allowed values array |
| `[EntityName]Relations`       | `const object` | Only for entities with relations; FK metadata  |

### Index Barrel (`lib/schemas/index.ts`)

The barrel file is auto-generated and must not be edited by hand. It contains:

```typescript
// Auto-generated by Zod Generator. Do not edit manually.

export * from "./UserSchema";
export * from "./ProductSchema";
export * from "./OrderSchema";
export * from "./OrderItemSchema";
// ... one line per entity
```

Consumers then import from a single path:

```typescript
import {
  UserSchema,
  CreateUserSchema,
  UpdateUserSchema,
  type User,
  type CreateUser,
  type UpdateUser,
} from "@/lib/schemas";
```

---

## 10. Stripe Billing Schemas

When an entity declares a `billing` block in the DSL, the generator emits additional Stripe-specific validation schemas alongside the standard entity schemas. These enforce that Stripe API identifiers conform to the expected prefix conventions.

### DSL Declaration

```yaml
entity: Account
billing:
  provider: stripe
  customerField: stripeCustomerId
  subscriptionField: subscriptionStatus
fields:
  name: string
  email: email
  stripeCustomerId: string
  subscriptionStatus: enum [active, past_due, canceled, trialing]
```

### Additional Stripe Schemas Generated

The billing declaration produces these extra exports in the same `[EntityName]Schema.ts` file:

```typescript
// Stripe identifier validation schema
export const AccountStripeFieldsSchema = z.object({
  stripeCustomerId: z.string().startsWith("cus_"),
  subscriptionStatus: z.enum(["active", "past_due", "canceled", "trialing"]),
});

// Stripe webhook payload validation (always generated when billing is declared)
export const AccountStripeWebhookSchema = z.object({
  id: z.string().startsWith("evt_"),
  type: z.string(),
  data: z.object({
    object: z.string().startsWith("cus_"),
  }),
});

export type AccountStripeFields = z.infer<typeof AccountStripeFieldsSchema>;
export type AccountStripeWebhook = z.infer<typeof AccountStripeWebhookSchema>;
```

### Rules for Stripe Schemas

1. **Customer ID validation**: Any field designated as `customerField` gets an additional `.startsWith("cus_")` validation in the Stripe schema.
2. **Webhook event schema**: Always generates `z.string().startsWith("evt_")` for the event ID field.
3. **The standard entity schemas** (full, create, update) are **unchanged** -- they still use plain `z.string()` for Stripe ID fields. The Stripe schemas are additive and optional to use.
4. **Subscription status enum** is included in the Stripe schema if a `subscriptionField` is declared.
5. **Billing metadata** is added to the entity's export:

```typescript
export const AccountBilling = {
  provider: "stripe",
  customerField: "stripeCustomerId",
  subscriptionField: "subscriptionStatus",
} as const;
```

### Full Generated Output for a Billed Entity

Putting it all together, the full `AccountSchema.ts` with billing:

```typescript
import { z } from "zod";

// Full schema
export const AccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  stripeCustomerId: z.string(),
  subscriptionStatus: z.enum(["active", "past_due", "canceled", "trialing"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Account = z.infer<typeof AccountSchema>;

// Create schema (auto-fields excluded)
export const CreateAccountSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  stripeCustomerId: z.string(),
  subscriptionStatus: z.enum(["active", "past_due", "canceled", "trialing"]),
});

export type CreateAccount = z.infer<typeof CreateAccountSchema>;

// Update schema (partial + id)
export const UpdateAccountSchema = z.object({
  id: z.string(),
}).merge(CreateAccountSchema.partial());

export type UpdateAccount = z.infer<typeof UpdateAccountSchema>;

// Billing configuration
export const AccountBilling = {
  provider: "stripe",
  customerField: "stripeCustomerId",
  subscriptionField: "subscriptionStatus",
} as const;

// Stripe-specific validation schemas
export const AccountStripeFieldsSchema = z.object({
  stripeCustomerId: z.string().startsWith("cus_"),
  subscriptionStatus: z.enum(["active", "past_due", "canceled", "trialing"]),
});

export const AccountStripeWebhookSchema = z.object({
  id: z.string().startsWith("evt_"),
  type: z.string(),
  data: z.object({
    object: z.string().startsWith("cus_"),
  }),
});
```
