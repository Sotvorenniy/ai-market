---
plugins: ["../.."]
description: Trigger. The fastify-best-practices skill loads on its own for a task in its area; the prompt does not name it.
tags: [trigger]
max_turns: 4
allowed_tools: [Read, Glob, Grep, Skill]
---

My Fastify server returns 500 with an empty body when a request fails JSON Schema validation on a POST route. How do I return a 400 with the validation errors instead? Answer briefly.
