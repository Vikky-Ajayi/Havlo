---
name: Blocked frontend dependency - @google/genai
description: @google/genai transitively requires protobufjs which is blocked by Replit security policy
---

`@google/genai` depends on `protobufjs` which Replit's npm security firewall blocks with a 403.

**Rule:** Do not add `@google/genai` to the frontend's package.json.

**Why:** It was listed as a dependency but never imported anywhere in `havlo_frontend/src/`. Removing it unblocks `npm install`.

**How to apply:** If AI/generative features are needed on the frontend, use the Groq API via the backend instead.
