---
name: Stale email throughput
description: Durable constraints for the automated stale-listing email pipeline.
---

Automated stale-listing delivery must keep each cycle bounded and must not run optional report-expansion requests inline with email generation.

**Why:** Large page/candidate batches held the cross-worker advisory lock beyond the delivery interval, while the second Groq request hit rate limits and introduced a long retry delay before an email could be sent.

**How to apply:** Keep the direct delivery batch sized for the target with modest headroom, pre-filter candidates from search metadata where safe, and reserve report expansion for interactive/manual report flows.