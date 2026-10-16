---
type: llm
weight: 1
---

The answer states the onion dependency rule: source dependencies point inward, toward the domain core. It says the core (domain and ports) depends on nothing outside itself, application services depend only on the core, and outer layers (routes or other delivery code, repositories, adapters, infrastructure) depend on inner layers and never the other way round. Mentioning file or folder names from the skill's reference layout is fine.
