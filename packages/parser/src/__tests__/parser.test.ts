import { describe, it, expect } from 'vitest';
import { parseDSL } from '../parser.js';

describe('parser', () => {
  it('parses a simple entity', () => {
    const dsl = `entity User {
  id uuid
  name string
  email string
}`;
    const { cst } = parseDSL(dsl);
    expect(cst).toBeDefined();
    expect((cst as any).type).toBe('ProgramNode');
  });

  it('parses entity with nullable field', () => {
    const dsl = `entity User {
  id uuid
  name string
  bio string ?
}`;
    const { cst } = parseDSL(dsl);
    const entity = (cst as any).declarations[0];
    expect(entity.name).toBe('User');
    expect(entity.fields.some((f: any) => f.name === 'bio' && f.isNullable)).toBe(true);
  });

  it('parses entity with relation', () => {
    const dsl = `entity Post {
  id uuid
  title string
  author User @relation(User)
}`;
    const { cst } = parseDSL(dsl);
    const entity = (cst as any).declarations[0];
    const authorField = entity.fields.find((f: any) => f.name === 'author');
    expect(authorField.relationTarget).toBe('User');
  });

  it('parses dashboard with card', () => {
    const dsl = `entity User {
  id uuid
  name string
}

dashboard Overview {
  card TotalUsers from User
}`;
    const { cst } = parseDSL(dsl);
    const dash = (cst as any).declarations.find((d: any) => d.type === 'DashboardNode');
    expect(dash.name).toBe('Overview');
    expect(dash.elements[0].type).toBe('CardNode');
    expect(dash.elements[0].name).toBe('TotalUsers');
  });

  it('parses dashboard with chart and where clause', () => {
    const dsl = `entity Post {
  id uuid
  title string
  published boolean
}

dashboard Stats {
  chart bar PublishedByStatus from Post by published where published == true
}`;
    const { cst } = parseDSL(dsl);
    const dash = (cst as any).declarations.find((d: any) => d.type === 'DashboardNode');
    const chart = dash.elements[0];
    expect(chart.type).toBe('ChartNode');
    expect(chart.sourceEntity).toBe('Post');
    expect(chart.whereClause).toBeDefined();
  });

  it('parses dashboard with table and labeled columns', () => {
    const dsl = `entity Product {
  id uuid
  name string
  price money
}

dashboard Store {
  table Products from Product {
    column name label "Product Name"
    column price label "Price"
  }
}`;
    const { cst } = parseDSL(dsl);
    const dash = (cst as any).declarations.find((d: any) => d.type === 'DashboardNode');
    const table = dash.elements[0];
    expect(table.type).toBe('TableViewNode');
    expect(table.columns[0].label).toBe('Product Name');
  });

  it('parses full SaaS template', () => {
    const dsl = `entity Organization {
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
}`;
    const { cst } = parseDSL(dsl);
    const decls = (cst as any).declarations;
    expect(decls).toHaveLength(4);
    expect(decls.filter((d: any) => d.type === 'EntityNode')).toHaveLength(3);
    expect(decls.filter((d: any) => d.type === 'DashboardNode')).toHaveLength(1);
  });

  it('throws on malformed DSL', () => {
    expect(() => parseDSL(`entity { }`)).toThrow();
  });

  it('throws on unknown token', () => {
    expect(() => parseDSL(`invalid_token_here`)).toThrow();
  });

  it('handles empty program', () => {
    const { cst } = parseDSL('');
    expect((cst as any).declarations).toHaveLength(0);
  });

  it('parses all field types', () => {
    const dsl = `entity AllTypes {
  id uuid
  name string
  age number
  active boolean
  createdAt date
  balance money
}`;
    const { cst } = parseDSL(dsl);
    const entity = (cst as any).declarations[0];
    expect(entity.fields).toHaveLength(6);
  });
});
