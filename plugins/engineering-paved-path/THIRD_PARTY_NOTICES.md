# Third-party notices

The plugin `engineering-paved-path` vendors the following skills from third-party
repositories. Each is distributed under the MIT License; the license text is reproduced below.

| Skill in this plugin | Upstream repository | Upstream path | License | Copyright |
|---|---|---|---|---|
| `skills/drizzle-orm-patterns` | [giuseppe-trisciuoglio/developer-kit](https://github.com/giuseppe-trisciuoglio/developer-kit) | `plugins/developer-kit-typescript/skills/drizzle-orm-patterns` | MIT | Copyright (c) 2025 Giuseppe Trisciuoglio |
| `skills/fastify-best-practices` | [mcollina/skills](https://github.com/mcollina/skills) | `skills/fastify` | MIT | Copyright (c) 2026 Matteo Collina |
| `skills/postgresql-table-design` | [wshobson/agents](https://github.com/wshobson/agents) | `plugins/database-design/skills/postgresql` | MIT | Copyright (c) 2024 Seth Hobson |
| `skills/zod` | [pproenca/dot-skills](https://github.com/pproenca/dot-skills) (branch `master`) | `skills/.curated/zod` | MIT | Copyright (c) 2025 pproenca (the upstream LICENSE names no holder; the repository owner is listed) |

## Local modifications

The vendored copies were adapted for this plugin:

- References to a specific private project (its paths, packages and conventions) were removed.
- References to skills that are not part of this plugin were removed or replaced with the
  namespaced names of skills in this plugin (for example `engineering-paved-path:onion-architecture`).
- `fastify-best-practices`: the upstream packaging file `tile.json` was removed; the skill
  directory was renamed from `fastify` to `fastify-best-practices`.
- `zod`: the internationalization example keeps only English message strings.

All other content is as published upstream.

## MIT License

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
