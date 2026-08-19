---
name: Groq model lifecycle
description: Groq model IDs can be retired and must be kept current.
---

The Groq API can reject a previously valid model ID with a 400 `model_decommissioned` error. The shared report-generation model should use a currently supported replacement and be easy to update.

**Why:** The retired `llama3-70b-8192` model caused all report-generation paths, including automatic stale-listing processing, to fail before producing a report.

**How to apply:** When Groq returns `model_decommissioned`, check Groq's current deprecations/recommendations and update the single shared model configuration used by all report generators.