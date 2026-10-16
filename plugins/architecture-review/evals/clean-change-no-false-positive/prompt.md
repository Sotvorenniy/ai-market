---
plugins: ["../..", "../../../engineering-paved-path"]
description: Negative. A change that respects the dependency rule gets no layering violation.
tags: [negative]
max_turns: 10
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---

Use the `architecture-review:architecture-reviewer` agent to review this change set of a backend that follows the onion architecture, and report its findings.

```diff
--- /dev/null
+++ b/src/domain/order-repository.ts
@@ -0,0 +1,5 @@
+import type { Order } from './order';
+
+export interface OrderRepository {
+  save(order: Order): Promise<void>;
+}
--- /dev/null
+++ b/src/application/place-order.ts
@@ -0,0 +1,10 @@
+import { Order } from '../domain/order';
+import type { OrderRepository } from '../domain/order-repository';
+
+export class PlaceOrder {
+  constructor(private readonly orders: OrderRepository) {}
+
+  async run(id: string, total: number) {
+    await this.orders.save(new Order(id, total));
+  }
+}
--- /dev/null
+++ b/src/infrastructure/db/order-repository.ts
@@ -0,0 +1,9 @@
+import { db } from './client';
+import type { Order } from '../../domain/order';
+import type { OrderRepository } from '../../domain/order-repository';
+
+export class DbOrderRepository implements OrderRepository {
+  async save(order: Order) {
+    await db.insert('orders', { id: order.id, total: order.total });
+  }
+}
```
