# PULSE Dating

PULSE is a mobile-first worldwide dating app where adults build future-oriented profiles through Vibe DNA onboarding.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/pulse-dating` — responsive React/Vite app with Clerk auth, onboarding, profile editing, and settings.
- `artifacts/api-server/src/routes/pulse.ts` — authenticated Phase 1 profile, Vibe DNA, preferences, settings, and onboarding APIs.
- `lib/db/src/schema/pulse.ts` — PostgreSQL schema for private account data, public profile data, preferences, settings, onboarding, media, and Phase 2 relationship architecture.
- `lib/api-spec/openapi.yaml` — source of truth for the API contract.
- `artifacts/pulse-dating/src/index.css` — PULSE visual system and responsive theme.

## Architecture decisions

- Clerk owns signup, login, email verification, Google sign-in, and browser session cookies; the API derives identity from Clerk and never accepts a client-supplied user ID.
- Public profile responses contain only dating-profile fields; exact birth date and voice media path are returned only to the signed-in owner edit view.
- User media uses App Storage presigned uploads; PostgreSQL stores object paths and metadata rather than file bytes.
- Phase 2 relationship entities are represented in the database schema but have no user-facing routes in Phase 1.

## Product

- Public landing page with responsive mobile-first presentation.
- Branded Clerk sign-in/sign-up screens with an 18+ message and Google-ready social sign-in.
- Eight-step Vibe DNA onboarding with persistent progress.
- Profile creation/editing for About Me, Future Goals, hobbies, lifestyle, languages, photos/videos, and separate Voice Vibe media.
- Settings for discovery visibility, privacy controls, saved discovery preferences, logout, notification placeholder, and deletion request placeholder.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- API changes must start in `lib/api-spec/openapi.yaml`, then run `pnpm --filter @workspace/api-spec run codegen` before updating routes or the frontend.
- Web Clerk auth uses same-origin session cookies; do not add bearer token handling to the web client.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
