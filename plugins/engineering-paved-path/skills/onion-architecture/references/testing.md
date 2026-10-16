# Testing by ring

The payoff of the onion is that the inner rings are testable without Docker.

| Ring | Test type | Lane | How |
|---|---|---|---|
| `domain.ts` | Pure unit | hermetic (`*.test.ts`) | Call functions, assert values. No mocks at all. |
| `service.ts` | Unit with **fakes of ports** | hermetic (`*.test.ts`) | Hand-written in-memory implementations of the port interfaces |
| `repository.ts` | Integration | Docker (e.g. `*.it.test.ts`) | a Postgres testcontainer helper, real migrations |
| `routes.ts` | Route smoke | hermetic | `app.inject()` with a Container built from test overrides / fake services |
| adapters | Contract / unit | hermetic | Against recorded payloads or adapter mocks |

Rules:
- **Fakes, not mocks, for ports.** A 20-line `InMemoryOrdersRepository implements
  OrdersRepositoryPort` is reusable and type-checked against the port; `vi.mock` of a
  module path couples the test to file layout.
- Keep tests that need a database in a separately named lane (for example `*.it.test.ts`)
  so the hermetic lane runs without Docker. If a service test needs Postgres, the service is
  reaching past its port.
- Example with Vitest: `npx vitest run --exclude '**/*.it.test.ts'` (hermetic) and
  `npx vitest run .it.test` (Docker).
