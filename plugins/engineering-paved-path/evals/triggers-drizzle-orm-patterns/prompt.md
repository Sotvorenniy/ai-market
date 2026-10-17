---
plugins: ["../.."]
description: Trigger. The drizzle-orm-patterns skill loads on its own for a task in its area; the prompt does not name it.
tags: [trigger]
max_turns: 4
allowed_tools: [Read, Glob, Grep, Skill]
---

With Drizzle ORM on PostgreSQL, how do I insert an order and its line items in one transaction so both roll back if one insert fails? Show a short TypeScript snippet.
