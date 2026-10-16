---
type: llm
weight: 2
---

The answer identifies `paymentRetryLimit: 5` as the setting and cites where it is defined with a file and line reference such as `src/config.ts:5`. Because the loop in `src/payments.ts` runs `attempt = 1..paymentRetryLimit`, the code makes at most 5 capture attempts in total (the first try plus 4 retries); an answer that says "5 attempts", "4 retries", or "up to 5 times" and points out that the comment wording is ambiguous is correct. It does not invent other values, files or config sources.
