---
plugins: ["../..", "../../../engineering-paved-path"]
description: The reviewer flags a domain entity that imports infrastructure.
max_turns: 10
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---

Use the `architecture-review:architecture-reviewer` agent to review this change set of a backend that follows the onion architecture, and report its findings.

```diff
--- a/src/domain/order.ts
+++ b/src/domain/order.ts
@@ -1,4 +1,6 @@
+import { db } from '../infrastructure/db/client';
+
 export class Order {
   constructor(readonly id: string, readonly total: number) {}
+
+  async save() {
+    await db.insert('orders', { id: this.id, total: this.total });
+  }
 }
```
