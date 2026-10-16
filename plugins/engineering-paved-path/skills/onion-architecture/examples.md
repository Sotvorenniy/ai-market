# Examples — BAD / GOOD

All examples use the reference layout from [SKILL.md](SKILL.md) and an illustrative
`orders` / `catalog` domain. Rule names in parentheses match
[templates/dependency-cruiser.cjs.tmpl](templates/dependency-cruiser.cjs.tmpl).

## 1. Query in a route (CRITICAL — `routes-no-data-access`)

```ts
// BAD — modules/orders/routes.ts
import { and, desc, eq } from 'drizzle-orm';
import * as t from '../../db/schema.js';

app.get('/customers/:id/orders', async (req) => {
  const rows = await container.db.select().from(t.orders)
    .where(eq(t.orders.customerId, req.params.id)).orderBy(desc(t.orders.createdAt));
  return rows.map(toOrderDto);
});
```

```ts
// GOOD — routes.ts only parses, calls, shapes
app.get('/customers/:id/orders', { schema: { params: IdParams } }, async (req) => {
  const { tenantId } = await getRequestContext(req);
  return service.listForCustomer(tenantId, req.params.id);
});

// ports.ts
export interface OrdersRepositoryPort {
  listByCustomer(tenantId: string, customerId: string): Promise<Order[]>;
}

// repository.ts — the only file that sees Drizzle
export class OrdersRepository implements OrdersRepositoryPort {
  constructor(private db: Db) {}
  async listByCustomer(tenantId: string, customerId: string) {
    const rows = await this.db.select().from(t.orders)
      .where(and(eq(t.orders.tenantId, tenantId), eq(t.orders.customerId, customerId)))
      .orderBy(desc(t.orders.createdAt));
    return rows.map(toOrder);
  }
}
```

## 2. Service locator (HIGH — `application-no-infrastructure`)

```ts
// BAD — modules/orders/service.ts
import type { Container } from '../../platform/container.js';
import { OrdersRepository } from './repository.js';

export class OrdersService {
  private repo: OrdersRepository;
  constructor(private container: Container) {
    this.repo = new OrdersRepository(container.db);
  }
}
```

```ts
// GOOD
import type { PaymentGateway, PaymentProviderId } from '../../ports/payments.js';
import type { OrdersRepositoryPort } from './ports.js';

export interface OrdersServiceDeps {
  orders: OrdersRepositoryPort;
  payments: (provider: PaymentProviderId) => Promise<PaymentGateway>;
}
export class OrdersService {
  constructor(private readonly deps: OrdersServiceDeps) {}
}

// platform/container.ts — composition root
get ordersService(): OrdersService {
  return (this._ordersService ??= new OrdersService({
    orders: this.ordersRepo,
    payments: (provider) => this.payments(provider),
  }));
}
```

## 3. Infrastructure type leaking through a port (CRITICAL)

```ts
// BAD — the port depends on the Drizzle schema
import type * as t from '../../db/schema.js';
export interface OrdersRepositoryPort {
  getById(tenantId: string, id: string): Promise<typeof t.orders.$inferSelect | undefined>;
}
```

```ts
// GOOD — the port speaks domain
import type { Order } from './domain.js';
export interface OrdersRepositoryPort {
  getById(tenantId: string, id: string): Promise<Order | undefined>;
}
```

## 4. Zod in the core (`core-zod-type-only`)

```ts
// BAD — domain.ts
import { z } from 'zod';
export const Priority = z.enum(['HIGH', 'NORMAL', 'LOW']);
export function highest(xs: unknown[]) { return xs.map((x) => Priority.parse(x)) /* … */; }
```

```ts
// GOOD — domain.ts reuses the contract type, parsing happened at the route
import type { z } from 'zod';
import type { Priority as PrioritySchema } from '../../contracts/orders.js';
export type Priority = z.infer<typeof PrioritySchema>;
const RANK: Record<Priority, number> = { LOW: 0, NORMAL: 1, HIGH: 2 };
export const highest = (xs: Priority[]): Priority =>
  xs.reduce<Priority>((a, b) => (RANK[b] > RANK[a] ? b : a), 'LOW');
```

## 5. Adapter reaching into a module (`adapters-not-inward-of-modules`)

```ts
// BAD — adapters/search/index.ts
import { MAX_RESULTS, INDEXED_FIELDS } from '../../modules/catalog/constants.js';
```

```ts
// GOOD — the constant belongs to the port, or is injected
// src/ports/search.ts
export interface SearchOptions { indexedFields: readonly string[]; maxResults: number; }
// adapters/search receives SearchOptions in its constructor;
// container.ts passes INDEXED_FIELDS / MAX_RESULTS from catalog/constants.
```

## 6. Transaction boundary (service decides, infra executes)

```ts
// BAD — the service holds a Drizzle tx
await this.container.db.transaction(async (tx) => {
  await tx.update(t.orders).set(patch).where(eq(t.orders.id, id));
  await tx.insert(t.ledgerEntries).values(entry);
});

// GOOD
await this.deps.uow.run(async ({ orders, ledger }) => {
  const order = await orders.update(tenantId, id, patch);
  if (changesTotal(patch)) await ledger.append(order);
});
```

## 7. Thin module — allowed vs not

```ts
// OK — health/routes.ts with no DB: returns data from a port
app.get('/health', async () => app.container.health.status());

// NOT OK — a routes-only module that queries
const rows = await container.db.select().from(t.orders)…   // → add service.ts + port
```
