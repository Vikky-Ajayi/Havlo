---
name: Rightmove stale search ordering
description: The automated stale-listing finder must request the oldest Rightmove results first.
---

The stale-listing discovery query uses Rightmove's oldest-first sort order and a sufficiently deep page window; newest-first pagination can return many valid listings while never reaching properties that have been on the market for six months.

**Why:** The normal newest-first result order caused the automated pipeline to spend a cycle inspecting fresh listings, producing very few prospect emails even though stale inventory existed.

**How to apply:** Preserve oldest-first ordering for this job and keep the candidate/page limits configurable so production can tune throughput without changing the eligibility rules.