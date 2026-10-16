---
plugins: ["../.."]
description: Trigger. The frontend-ui-architecture skill loads on its own for a task in its area; the prompt does not name it.
tags: [trigger]
max_turns: 4
allowed_tools: [Read, Glob, Grep, Skill]
---

In our Next.js App Router project, the OrderPage component has grown to 600 lines with data fetching, price calculations and the markup all in one file. How should I split it and where should each part live? Answer briefly.
