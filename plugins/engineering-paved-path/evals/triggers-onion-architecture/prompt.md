---
plugins: ["../.."]
description: Trigger. The onion-architecture skill loads on its own for a task in its area; the prompt does not name it.
tags: [trigger]
max_turns: 4
allowed_tools: [Read, Glob, Grep, Skill]
---

Our TypeScript backend is a Fastify app with Drizzle, split into feature modules with routes, services and repositories. I need to add a query that loads an order with its line items. Which file or layer should that query go in, and what may import it? Answer briefly.
