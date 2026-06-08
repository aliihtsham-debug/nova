# Billing Generator Specification

## Overview

The billing generator produces Stripe integration code for subscription-based billing. It is conditionally included when `--billing` is set or `billing: true` in config.

## Generated Files

| File | Purpose |
|------|---------|
| `src/lib/stripe.ts` | Stripe client initialization |
| `src/app/api/stripe/webhook/route.ts` | Stripe webhook handler |
| `src/app/api/stripe/checkout/route.ts` | Checkout session creator |
| `src/app/api/stripe/portal/route.ts` | Customer portal redirect |
| `src/app/billing/page.tsx` | Pricing/plans display page |
| `src/app/billing/success/page.tsx` | Post-checkout success page |
| `src/app/billing/cancel/page.tsx` | Checkout cancelled page |
| `src/lib/actions/billing.ts` | Server actions for billing |

## Database Schema (via Prisma Generator)

### Plan Model

```prisma
model Plan {
  id        String   @id @default(uuid())
  name      String   @unique
  stripeId  String   @unique
  price     Int      // Price in cents
  interval  Interval
  features  String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Subscription Model

```prisma
model Subscription {
  id               String             @id @default(uuid())
  stripeId         String             @unique
  status           SubscriptionStatus
  currentPeriodEnd DateTime
  cancelAtPeriodEnd Boolean          @default(false)

  userId String
  planId String

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan Plan @relation(fields: [planId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Usage Token Model

```prisma
model UsageToken {
  id        String   @id @default(uuid())
  action    String
  metadata  Json?
  userId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, action, createdAt])
}
```

### Enums

```prisma
enum Interval {
  MONTH
  YEAR
}

enum SubscriptionStatus {
  ACTIVE
  CANCELED
  PAST_DUE
  UNPAID
  TRIALING
}
```

## Stripe Client

```typescript
// src/lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
  typescript: true,
});
```

## Checkout Session

```typescript
// src/app/api/stripe/checkout/route.ts
import { stripe } from '@/lib/stripe';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { priceId } = await request.json();

  // Get or create Stripe customer
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true },
  });

  let stripeCustomerId: string | undefined;

  // Create checkout session
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXTAUTH_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/billing/cancel`,
    metadata: { userId: session.user.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
```

## Webhook Handler

```typescript
// src/app/api/stripe/webhook/route.ts
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (userId) {
        await prisma.subscription.create({
          data: {
            stripeId: session.subscription as string,
            status: 'ACTIVE',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            userId,
            planId: '', // Lookup from Stripe price
          },
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await prisma.subscription.update({
        where: { stripeId: subscription.id },
        data: {
          status: subscription.status.toUpperCase() as any,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await prisma.subscription.update({
        where: { stripeId: subscription.id },
        data: { status: 'CANCELED' },
      });
      break;
    }
  }

  return new Response('OK', { status: 200 });
}
```

## Customer Portal

```typescript
// src/app/api/stripe/portal/route.ts
import { stripe } from '@/lib/stripe';
import { auth } from '@/lib/auth';

export async function POST() {
  const session = await auth();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Lookup Stripe customer ID (stored on user or subscription)
  // Create portal session
  const portalSession = await stripe.billingPortalSessions.create({
    customer: 'cus_xxx',
    return_url: `${process.env.NEXTAUTH_URL}/billing`,
  });

  return Response.redirect(portalSession.url);
}
```

## Usage Metering

Track user actions against plan limits:

```typescript
// src/lib/usage.ts
import { prisma } from '@/lib/prisma';

export async function trackUsage(userId: string, action: string, metadata?: Record<string, unknown>) {
  await prisma.usageToken.create({
    data: { userId, action, metadata },
  });
}

export async function getUsageCount(userId: string, action: string, since: Date): Promise<number> {
  return prisma.usageToken.count({
    where: { userId, action, createdAt: { gte: since } },
  });
}

export async function checkLimit(userId: string, action: string, limit: number): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (!subscription || subscription.status !== 'ACTIVE') {
    return false; // No active subscription
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const count = await getUsageCount(userId, action, startOfDay);
  return count < limit;
}
```

## Pricing Page

Generates a pricing page that displays all plans from the database:

```tsx
// src/app/billing/page.tsx
// Displays cards for each plan with:
// - Plan name
// - Price (formatted from cents)
// - Interval (monthly/yearly)
// - Features list
// - Subscribe button (creates checkout session)
```

## Zod Schemas

```typescript
// In Zod generator, when billing is enabled:
export const CheckoutSchema = z.object({
  priceId: z.string(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const PlanCreateSchema = z.object({
  name: z.string().min(1),
  stripeId: z.string().min(1),
  price: z.number().int().positive(),
  interval: z.enum(['MONTH', 'YEAR']),
  features: z.array(z.string()),
});
```

## Environment Variables

Required when billing is enabled:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```
