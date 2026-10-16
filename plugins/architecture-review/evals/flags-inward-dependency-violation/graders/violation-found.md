---
type: llm
weight: 2
---

The review reports a layering violation as a blocking or high-severity finding: the domain entity `Order` in `src/domain/order.ts` imports infrastructure (`../infrastructure/db/client`) and persists itself, so the dependency points outward from the core. It proposes a fix in the spirit of the onion architecture, such as a repository port in the domain or application layer implemented in infrastructure.
