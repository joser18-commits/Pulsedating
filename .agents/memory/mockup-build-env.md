---
name: Mockup sandbox build environment
description: Environment variables required when building the registered mockup sandbox outside its managed workflow.
---

The mockup sandbox Vite build requires both `PORT` and `BASE_PATH` when run directly; its managed workflow supplies these automatically.

**Why:** A workspace-wide build otherwise fails before reaching the application packages, even though typechecking and the app builds are healthy.

**How to apply:** When running the full workspace build manually, provide the sandbox values that match its registered route, such as `PORT=8081 BASE_PATH=/__mockup`.